"use server";

import { and, eq, ne } from "drizzle-orm";

import { session, user } from "@/db/schema/auth";
import { attachments } from "@/db/schema/attachments";
import { auditLogs } from "@/db/schema/audit-logs";
import { files } from "@/db/schema/files";
import { notes } from "@/db/schema/notes";
import { audit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { ActionError, action, actionNoTx, type ActionContext } from "@/lib/rbac";
import { ROLES } from "@/lib/roles";

import { assertNotHidden, assertNotSelf } from "./domain";
import { createUserSchema, updateUserSchema, userIdSchema } from "./schema";

// Admin user provisioning. Authorization is OURS (the guard wrappers), so Better
// Auth is used only where it must own the work — `createUser` (password hashing +
// the `account` row), via the no-headers bypass the seed uses.

// Reject the change if it would leave zero active administrators (operational
// lockout). WEBMASTER is hidden/seed-only and intentionally NOT counted as a
// day-to-day admin. Runs inside the action's transaction.
async function assertNotLastActiveAdmin(tx: ActionContext["tx"], excludeId: string): Promise<void> {
  const others = await tx
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.role, ROLES.ADMIN), eq(user.isActive, true), ne(user.id, excludeId)))
    .limit(1);
  if (others.length === 0) {
    throw new ActionError("This is the last active administrator — assign another admin first.");
  }
}

// "Has records" decides hard- vs soft-delete: a user who has authored anything OR
// performed any audited action is archived (soft) so their history/attribution
// survives; a user who never acted is removed for good. Checks run sequentially
// (one txn connection can't run parallel queries) and short-circuit on the first
// hit — audit first, since any real activity leaves an audit trail.
async function userHasRecords(tx: ActionContext["tx"], userId: string): Promise<boolean> {
  const probes = [
    tx.select({ one: auditLogs.id }).from(auditLogs).where(eq(auditLogs.actorId, userId)).limit(1),
    tx.select({ one: files.id }).from(files).where(eq(files.uploadedBy, userId)).limit(1),
    tx
      .select({ one: attachments.id })
      .from(attachments)
      .where(eq(attachments.createdBy, userId))
      .limit(1),
    tx.select({ one: notes.id }).from(notes).where(eq(notes.createdBy, userId)).limit(1),
  ];
  for (const probe of probes) {
    if ((await probe).length > 0) return true;
  }
  return false;
}

// No ambient transaction: `auth.api.createUser` runs on its own connection and
// commits independently, so nesting it inside our transaction would risk a
// PgBouncer deadlock AND make the create non-atomic with the audit anyway.
export const createUserAction = actionNoTx(
  "user.create",
  createUserSchema,
  async (input, { user: actor, db }) => {
    const existing = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, input.email))
      .limit(1);
    if (existing.length > 0) {
      throw new ActionError("That email is already registered.");
    }

    // Better Auth creates user + account (hashes the password). isActive is an
    // `input: false` field defaulting to true, so we don't pass it. No headers =
    // the bootstrap bypass (same as src/db/seed.ts).
    let createdId: string;
    try {
      const result = await auth.api.createUser({
        body: {
          email: input.email,
          password: input.password,
          name: input.name,
          role: input.role as unknown as "admin",
        },
      });
      createdId = result.user.id;
    } catch (err) {
      console.error("[users.create] createUser failed", err);
      throw new ActionError("Could not create the account. Check the details and try again.");
    }

    // The account exists now. Audit is BEST-EFFORT: a failed audit write must not
    // report creation as failed — that would orphan the account and mislead the
    // operator into retrying into "email already registered".
    try {
      await db.transaction((tx) =>
        audit(tx, {
          actorId: actor.id,
          action: "user.created",
          entityType: "user",
          entityId: createdId,
          summary: `Created ${input.email} (${input.role})`,
          diff: { name: input.name, email: input.email, role: input.role },
        }),
      );
    } catch (err) {
      console.error("[users.create] account created but audit write failed", err);
    }

    return { id: createdId };
  },
);

export const updateUserAction = action(
  "user.update",
  updateUserSchema,
  async (input, { user: actor, tx }) => {
    const [target] = await tx
      .select({ id: user.id, name: user.name, email: user.email, role: user.role })
      .from(user)
      .where(eq(user.id, input.id))
      .limit(1);
    if (!target) throw new ActionError("User not found.");
    assertNotHidden(target.role);

    // Don't let an admin demote themselves out of user management mid-edit.
    if (input.id === actor.id && input.role !== target.role) {
      throw new ActionError("You can't change your own role.");
    }
    // Don't demote the last active admin away from ADMIN.
    if (target.role === ROLES.ADMIN && input.role !== ROLES.ADMIN) {
      await assertNotLastActiveAdmin(tx, input.id);
    }

    // Email is the login identity; changing it stays safe because sign-in resolves
    // the credential account by userId (account.accountId = user id, not the email),
    // so a direct update keeps email+password login working. Only guard uniqueness
    // when it actually changed — re-saving the same email must not false-positive.
    if (input.email !== target.email) {
      const clash = await tx
        .select({ id: user.id })
        .from(user)
        .where(and(eq(user.email, input.email), ne(user.id, input.id)))
        .limit(1);
      if (clash.length > 0) {
        throw new ActionError("That email is already registered.");
      }
    }

    await tx
      .update(user)
      .set({ name: input.name, email: input.email, role: input.role })
      .where(eq(user.id, input.id));

    await audit(tx, {
      actorId: actor.id,
      action: "user.updated",
      entityType: "user",
      entityId: input.id,
      summary: `Updated ${target.name}`,
      diff: {
        name: { from: target.name, to: input.name },
        email: { from: target.email, to: input.email },
        role: { from: target.role, to: input.role },
      },
    });

    return { id: input.id };
  },
);

export const deactivateUserAction = action(
  "user.deactivate",
  userIdSchema,
  async (input, { user: actor, tx }) => {
    assertNotSelf(actor.id, input.id);

    const [target] = await tx
      .select({ id: user.id, name: user.name, role: user.role })
      .from(user)
      .where(eq(user.id, input.id))
      .limit(1);
    if (!target) throw new ActionError("User not found.");
    assertNotHidden(target.role);
    if (target.role === ROLES.ADMIN) await assertNotLastActiveAdmin(tx, input.id);

    await tx.update(user).set({ isActive: false }).where(eq(user.id, input.id));
    // Delete the session rows: this blocks ALL of their writes immediately (the
    // guard re-reads via getFreshSession) and blocks reads once their ≤60s cookie
    // cache expires. It does NOT retroactively void an already-issued cookie
    // snapshot — that's the intended 60s read-staleness window (docs/17 §3).
    await tx.delete(session).where(eq(session.userId, input.id));

    await audit(tx, {
      actorId: actor.id,
      action: "user.deactivated",
      entityType: "user",
      entityId: input.id,
      summary: `Deactivated ${target.name}`,
    });

    return { id: input.id };
  },
);

export const reactivateUserAction = action(
  "user.deactivate",
  userIdSchema,
  async (input, { user: actor, tx }) => {
    const [target] = await tx
      .select({ id: user.id, name: user.name, role: user.role })
      .from(user)
      .where(eq(user.id, input.id))
      .limit(1);
    if (!target) throw new ActionError("User not found.");
    assertNotHidden(target.role);

    await tx.update(user).set({ isActive: true }).where(eq(user.id, input.id));

    await audit(tx, {
      actorId: actor.id,
      action: "user.reactivated",
      entityType: "user",
      entityId: input.id,
      summary: `Reactivated ${target.name}`,
    });

    return { id: input.id };
  },
);

// Hard-delete a user who never acted (session + account cascade); otherwise
// soft-delete (archive) to preserve their history and audit attribution. The
// guards mirror deactivate: can't act on yourself, the hidden webmaster, or the
// last active admin.
export const deleteUserAction = action(
  "user.delete",
  userIdSchema,
  async (input, { user: actor, tx }) => {
    assertNotSelf(actor.id, input.id);

    const [target] = await tx
      .select({ id: user.id, name: user.name, role: user.role })
      .from(user)
      .where(eq(user.id, input.id))
      .limit(1);
    if (!target) throw new ActionError("User not found.");
    assertNotHidden(target.role);
    if (target.role === ROLES.ADMIN) await assertNotLastActiveAdmin(tx, input.id);

    if (await userHasRecords(tx, input.id)) {
      // Soft delete: archive, lock out, and revoke sessions (same lockout as
      // deactivation). Audit attribution on their past actions stays intact.
      await tx
        .update(user)
        .set({ deletedAt: new Date(), isActive: false })
        .where(eq(user.id, input.id));
      await tx.delete(session).where(eq(session.userId, input.id));

      await audit(tx, {
        actorId: actor.id,
        action: "user.soft_deleted",
        entityType: "user",
        entityId: input.id,
        summary: `Archived ${target.name} (had records)`,
      });

      return { id: input.id, mode: "soft" as const };
    }

    // Hard delete: nothing references this user. Write the audit row first (actorId
    // is the admin, who survives); session + account rows cascade with the user.
    await audit(tx, {
      actorId: actor.id,
      action: "user.deleted",
      entityType: "user",
      entityId: input.id,
      summary: `Permanently deleted ${target.name}`,
    });
    await tx.delete(user).where(eq(user.id, input.id));

    return { id: input.id, mode: "hard" as const };
  },
);

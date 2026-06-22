import { and, eq, inArray, isNull, notInArray, type SQL } from "drizzle-orm";
import { z } from "zod";

import { db, type Database } from "@/db/client";
import { user } from "@/db/schema/auth";
import { projectMembers } from "@/db/schema/project-members";
import { projects } from "@/db/schema/projects";
import {
  PERMISSION_KEYS,
  ROLE_PERMISSIONS,
  hasPermission,
  requirePermission,
  type Permission,
} from "@/lib/permissions";
import { HIDDEN_ROLES, ROLES, isHiddenRole, type Role } from "@/lib/roles";
import { getFreshSession, isAuthorized, type SessionUser } from "@/lib/session";

// The pure authorization model lives in the client/test-safe `@/lib/roles` and
// `@/lib/permissions`. Re-export here so server callers keep one import surface
// (`@/lib/rbac`) for the guard + the model. This file owns the DB-COUPLED parts.
export { ROLES, HIDDEN_ROLES, isHiddenRole, type Role };
export { PERMISSION_KEYS, ROLE_PERMISSIONS, hasPermission, requirePermission, type Permission };

/**
 * Drizzle predicate that excludes hidden roles AND soft-deleted (archived) users.
 * EVERY user listing, count, and approver/assignee picker MUST apply this —
 * server-side — or the hidden webmaster leaks or an archived account resurfaces.
 */
export function visibleUserWhere() {
  return and(notInArray(user.role, HIDDEN_ROLES as string[]), isNull(user.deletedAt));
}

function roleOf(u: SessionUser | { role?: string | null }): string | null {
  return (u as { role?: string | null }).role ?? null;
}

// ── The one Server Action guard (docs/17 §5) ────────────────────────────────
// session → account (is_active/banned) → permission → validate(zod) → handler.
// No raw Server Action should bypass this — an unguarded action is a public POST.
// Project-scoping for engineers is injected here once the projects table exists
// (Stage 2); the hook is the `ctx` passed to the handler.
//
// Uses getFreshSession (DB-authoritative, bypasses the cookie cache): every
// mutation re-validates the account + role against the DB, so deactivation and
// role changes take effect immediately on the write path regardless of the 60s
// read-cache window. The READ gate (AuthGate) uses the cheap cached getSession.

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Handler context for `action()` — runs inside a DB transaction. */
export type ActionContext = { user: SessionUser; tx: Tx };
/** Handler context for `actionNoTx()` — no ambient transaction; the handler owns
 *  its atomicity via `ctx.db`. Use when calling Better Auth APIs (createUser, …),
 *  which run on their OWN connection and must not be nested inside an open
 *  transaction (a second pooled connection inside a txn can deadlock PgBouncer). */
export type NoTxActionContext = { user: SessionUser; db: Database };

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * A handler-thrown error whose message is SAFE to show the user (e.g. a domain
 * rule: "That email is already registered."). The guards turn it into a clean
 * `{ ok: false, error }`; any OTHER thrown error is logged and returned as a
 * generic message so internals never leak to the client.
 */
export class ActionError extends Error {}

// ── Project scoping (docs/17 §10.2) ─────────────────────────────────────────
// Engineers see ONLY projects they belong to. Two enforcement points, both here
// so the rule is written once:
//   • assertProjectAccess — the WRITE guard. Called on the RESOLVED project id of
//     every project-scoped mutation (after task→phase→project / dsr→project
//     lookup). A non-member id throws "Project not found." (the action returns a
//     clean error; a guessed id is indistinguishable from a missing one — no IDOR
//     leak). Admins bypass via `project.view.all`.
//   • projectAccessWhere — the READ predicate. AND it into any `projects` list so
//     the query physically can't return projects the user isn't a member of.

type Executor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

export async function assertProjectAccess(
  exec: Executor,
  args: { userId: string; role: string | null; projectId: string },
): Promise<void> {
  if (hasPermission(args.role, "project.view.all")) return;
  const [row] = await exec
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(
      and(eq(projectMembers.projectId, args.projectId), eq(projectMembers.userId, args.userId)),
    )
    .limit(1);
  if (!row) throw new ActionError("Project not found.");
}

/** Membership predicate for project list reads — `undefined` (no restriction) for
 *  admins/webmaster (`project.view.all`), else `projects.id IN (my memberships)`. */
export function projectAccessWhere(role: string | null, userId: string): SQL | undefined {
  if (hasPermission(role, "project.view.all")) return undefined;
  return inArray(
    projects.id,
    db
      .select({ id: projectMembers.projectId })
      .from(projectMembers)
      .where(eq(projectMembers.userId, userId)),
  );
}

// Shared session → account → permission → validate pipeline. Fails CLOSED if the
// session read throws (e.g. DB unreachable).
async function authorize<TInput>(
  permission: Permission,
  schema: z.ZodType<TInput>,
  rawInput: unknown,
): Promise<{ ok: true; user: SessionUser; input: TInput } | { ok: false; error: string }> {
  let session: Awaited<ReturnType<typeof getFreshSession>>;
  try {
    session = await getFreshSession();
  } catch (err) {
    console.error(`[action:${permission}] session read failed`, err);
    return { ok: false, error: "Not authenticated" };
  }
  if (!session) return { ok: false, error: "Not authenticated" };
  if (!isAuthorized(session)) return { ok: false, error: "Account is inactive" };
  if (!hasPermission(roleOf(session.user), permission)) return { ok: false, error: "Forbidden" };

  const parsed = schema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  return { ok: true, user: session.user, input: parsed.data };
}

function toErrorResult(err: unknown, permission: Permission): { ok: false; error: string } {
  if (err instanceof ActionError) return { ok: false, error: err.message };
  console.error(`[action:${permission}] unexpected error`, err);
  return { ok: false, error: "Something went wrong. Please try again." };
}

/** Guarded mutation that runs the handler inside a DB transaction. */
export function action<TInput, TOutput>(
  permission: Permission,
  schema: z.ZodType<TInput>,
  handler: (input: TInput, ctx: ActionContext) => Promise<TOutput>,
): (rawInput: unknown) => Promise<ActionResult<TOutput>> {
  return async (rawInput) => {
    const authd = await authorize(permission, schema, rawInput);
    if (!authd.ok) return authd;
    try {
      const data = await db.transaction((tx) => handler(authd.input, { user: authd.user, tx }));
      return { ok: true, data };
    } catch (err) {
      return toErrorResult(err, permission);
    }
  };
}

/** Guarded mutation WITHOUT an ambient transaction — for handlers that call Better
 *  Auth APIs. The handler manages its own atomicity via `ctx.db`. */
export function actionNoTx<TInput, TOutput>(
  permission: Permission,
  schema: z.ZodType<TInput>,
  handler: (input: TInput, ctx: NoTxActionContext) => Promise<TOutput>,
): (rawInput: unknown) => Promise<ActionResult<TOutput>> {
  return async (rawInput) => {
    const authd = await authorize(permission, schema, rawInput);
    if (!authd.ok) return authd;
    try {
      const data = await handler(authd.input, { user: authd.user, db });
      return { ok: true, data };
    } catch (err) {
      return toErrorResult(err, permission);
    }
  };
}

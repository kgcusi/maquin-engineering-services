import { createElement } from "react";
import { and, asc, eq, inArray, isNull, lt, lte, or } from "drizzle-orm";

import type { Database } from "@/db/client";
import { user } from "@/db/schema/auth";
import { notifications } from "@/db/schema/notifications";
import { notificationSettings } from "@/db/schema/notification-settings";
import { outbox } from "@/db/schema/outbox";
import { projectMembers } from "@/db/schema/project-members";
import NotificationEmail from "@/emails/notification-email";
import { audit } from "@/lib/audit";
import { sendEmail } from "@/lib/mailer";
import {
  NOTIFICATION_EVENTS,
  TEST_EVENT_KEY,
  humanizeEvent,
  type NotificationChannel,
} from "@/lib/notification-events";
import { ActionError } from "@/lib/rbac";
import type { SessionUser } from "@/lib/session";
import { getResendCredentials } from "@/modules/settings/queries";

import {
  DISPATCH_BATCH,
  MAX_ATTEMPTS,
  backoffMs,
  buildIdempotencyKey,
  buildNotificationContent,
  parseChannels,
  parseRecipientRule,
} from "./domain";

type Recipient = { id: string; email: string; name: string };

const ACTIVE_USER = or(isNull(user.isActive), eq(user.isActive, true));

// Resolve a recipient_rule against the directory. ROLE:* / USER:<field> /
// PROJECT:<selector> are all supported. PROJECT:* resolves the payload's
// `projectId` via project_members (Stage 2): a "LEAD" selector → the lead only,
// anything else → the full team (LEAD + MEMBER). The hidden WEBMASTER never
// matches ROLE:ADMIN (role is matched exactly), preserving the hidden-superuser
// invariant. The actor is excluded by the caller (no "you did X" self-notes).
async function resolveRecipients(
  db: Database,
  rule: string | null,
  payload: Record<string, unknown>,
): Promise<Recipient[]> {
  const parsed = parseRecipientRule(rule);

  if (parsed.kind === "ROLE") {
    return db
      .select({ id: user.id, email: user.email, name: user.name })
      .from(user)
      .where(and(eq(user.role, parsed.role), isNull(user.deletedAt), ACTIVE_USER));
  }

  if (parsed.kind === "USER") {
    const userId = payload[parsed.field];
    if (typeof userId !== "string" || !userId) return [];
    return db
      .select({ id: user.id, email: user.email, name: user.name })
      .from(user)
      .where(and(eq(user.id, userId), isNull(user.deletedAt), ACTIVE_USER));
  }

  if (parsed.kind === "PROJECT") {
    const projectId = payload.projectId;
    if (typeof projectId !== "string" || !projectId) return [];
    const roles = parsed.selector.includes("LEAD") ? ["LEAD"] : ["LEAD", "MEMBER"];
    return db
      .select({ id: user.id, email: user.email, name: user.name })
      .from(projectMembers)
      .innerJoin(user, eq(projectMembers.userId, user.id))
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          inArray(projectMembers.roleOnProject, roles),
          isNull(user.deletedAt),
          ACTIVE_USER,
        ),
      );
  }

  return [];
}

// ── Phase 1: drain the outbox into notification rows ────────────────────────
export async function dispatchOutbox(
  db: Database,
): Promise<{ processed: number; created: number }> {
  const events = await db
    .select()
    .from(outbox)
    .where(eq(outbox.status, "QUEUED"))
    .orderBy(asc(outbox.createdAt))
    .limit(DISPATCH_BATCH);

  let created = 0;

  for (const event of events) {
    try {
      const [settings] = await db
        .select()
        .from(notificationSettings)
        .where(eq(notificationSettings.eventKey, event.eventType))
        .limit(1);

      const channels = settings?.enabled ? parseChannels(settings.channels) : [];
      const payload = (event.payload ?? {}) as Record<string, unknown>;
      const resolved = channels.length
        ? await resolveRecipients(db, settings.recipientRule, payload)
        : [];
      // Never notify the actor about their own action (docs/17 §10.8).
      const actorId = typeof payload.actorId === "string" ? payload.actorId : null;
      const recipients = actorId ? resolved.filter((r) => r.id !== actorId) : resolved;

      const label =
        NOTIFICATION_EVENTS[event.eventType as keyof typeof NOTIFICATION_EVENTS]?.label ??
        humanizeEvent(event.eventType);
      const content = buildNotificationContent(label, payload);
      const scopeId = content.entityId ?? event.id;
      const now = new Date();

      await db.transaction(async (tx) => {
        for (const recipient of recipients) {
          for (const channel of channels) {
            await tx
              .insert(notifications)
              .values({
                eventKey: event.eventType,
                recipientId: recipient.id,
                channel,
                subject: content.subject,
                body: content.body,
                status: channel === "IN_APP" ? "SENT" : "QUEUED",
                sentAt: channel === "IN_APP" ? now : null,
                idempotencyKey: buildIdempotencyKey({
                  eventKey: event.eventType,
                  scopeId,
                  recipientId: recipient.id,
                  channel,
                }),
                entityType: content.entityType,
                entityId: content.entityId,
              })
              .onConflictDoNothing({ target: notifications.idempotencyKey });
            created += 1;
          }
        }
        await tx
          .update(outbox)
          .set({ status: "SENT", processedAt: now })
          .where(eq(outbox.id, event.id));
      });
    } catch (err) {
      // Bump the outbox row's attempt counter OUTSIDE the rolled-back transaction.
      const attempts = event.attempts + 1;
      await db
        .update(outbox)
        .set({
          attempts,
          lastError: String(err instanceof Error ? err.message : err).slice(0, 500),
          status: attempts >= MAX_ATTEMPTS ? "FAILED" : "QUEUED",
        })
        .where(eq(outbox.id, event.id));
    }
  }

  return { processed: events.length, created };
}

// ── Phase 2: send QUEUED email notifications via Resend ─────────────────────
export async function deliverQueued(
  db: Database,
): Promise<{ delivered: number; failed: number; skipped: number }> {
  const { apiKey, fromAddress } = await getResendCredentials();

  const now = new Date();
  const rows = await db
    .select({
      id: notifications.id,
      subject: notifications.subject,
      body: notifications.body,
      attempts: notifications.attempts,
      email: user.email,
      name: user.name,
    })
    .from(notifications)
    .innerJoin(user, eq(notifications.recipientId, user.id))
    .where(
      and(
        eq(notifications.channel, "EMAIL"),
        inArray(notifications.status, ["QUEUED", "FAILED"]),
        lt(notifications.attempts, MAX_ATTEMPTS),
        or(isNull(notifications.nextAttemptAt), lte(notifications.nextAttemptAt, now)),
      ),
    )
    .orderBy(asc(notifications.createdAt))
    .limit(DISPATCH_BATCH);

  // No Resend credentials yet — leave rows QUEUED so they send once configured.
  if (!apiKey || !fromAddress) {
    return { delivered: 0, failed: 0, skipped: rows.length };
  }

  const appUrl = process.env.APP_BASE_URL || null;
  let delivered = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const react = createElement(NotificationEmail, {
        heading: row.subject,
        message: row.body,
        recipientName: row.name,
        actionUrl: appUrl,
        actionLabel: appUrl ? "Open dashboard" : null,
      });
      const res = await sendEmail({
        to: row.email,
        subject: row.subject,
        react,
        apiKey,
        from: fromAddress,
      });
      if (res.error) {
        await markEmailFailed(db, row.id, row.attempts, res.error.message);
        failed += 1;
      } else {
        await markEmailSent(db, row.id, res.data?.id ?? null, row.subject, row.email);
        delivered += 1;
      }
    } catch (err) {
      await markEmailFailed(
        db,
        row.id,
        row.attempts,
        err instanceof Error ? err.message : String(err),
      );
      failed += 1;
    }
  }

  return { delivered, failed, skipped: 0 };
}

async function markEmailSent(
  db: Database,
  id: string,
  messageId: string | null,
  subject: string,
  email: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(notifications)
      .set({ status: "SENT", sentAt: new Date(), resendMessageId: messageId, lastError: null })
      .where(eq(notifications.id, id));
    await audit(tx, {
      actorId: null, // system send
      action: "notification.sent",
      entityType: "notification",
      entityId: id,
      summary: `Sent “${subject}” to ${email}`,
    });
  });
}

async function markEmailFailed(
  db: Database,
  id: string,
  prevAttempts: number,
  message: string,
): Promise<void> {
  const attempts = prevAttempts + 1;
  await db
    .update(notifications)
    .set({
      attempts,
      lastError: message.slice(0, 500),
      status: attempts >= MAX_ATTEMPTS ? "FAILED" : "QUEUED",
      nextAttemptAt: new Date(Date.now() + backoffMs(attempts)),
    })
    .where(eq(notifications.id, id));
}

// ── Test panel: run the full pipeline inline to the actor ───────────────────
// Stronger than the (no-send) connection test — it actually delivers an email and
// drops an unread in-app notice, so the webmaster sees the bell light up.
export async function sendTest(
  db: Database,
  actor: SessionUser,
): Promise<{ messageId: string | null }> {
  const { apiKey, fromAddress } = await getResendCredentials();
  if (!apiKey) throw new ActionError("Add and save a Resend API key first (Email delivery).");
  if (!fromAddress) throw new ActionError("Add and save a sender address first (Email delivery).");
  if (!actor.email) throw new ActionError("Your account has no email address to send to.");

  const subject = "Test notification";
  const body =
    "This is a test notification from MAQUIN Engineering Services. If you received this email, your Resend email delivery is configured correctly.";
  const appUrl = process.env.APP_BASE_URL || null;

  let messageId: string | null = null;
  try {
    const res = await sendEmail({
      to: actor.email,
      subject,
      react: createElement(NotificationEmail, {
        heading: subject,
        message: body,
        recipientName: actor.name,
        actionUrl: appUrl,
        actionLabel: appUrl ? "Open dashboard" : null,
      }),
      apiKey,
      from: fromAddress,
    });
    if (res.error) throw new ActionError(res.error.message || "Resend rejected the send.");
    messageId = res.data?.id ?? null;
  } catch (err) {
    if (err instanceof ActionError) throw err;
    throw new ActionError("Could not reach Resend. Check the API key and sender address.");
  }

  const now = new Date();
  const nonce = String(now.getTime());
  const mk = (channel: NotificationChannel) =>
    buildIdempotencyKey({
      eventKey: TEST_EVENT_KEY,
      scopeId: nonce,
      recipientId: actor.id,
      channel,
    });

  await db.transaction(async (tx) => {
    await tx.insert(notifications).values([
      {
        eventKey: TEST_EVENT_KEY,
        recipientId: actor.id,
        channel: "EMAIL",
        subject,
        body,
        status: "SENT",
        sentAt: now,
        resendMessageId: messageId,
        idempotencyKey: mk("EMAIL"),
      },
      {
        eventKey: TEST_EVENT_KEY,
        recipientId: actor.id,
        channel: "IN_APP",
        subject,
        body,
        status: "SENT",
        sentAt: now,
        idempotencyKey: mk("IN_APP"),
      },
    ]);
    await audit(tx, {
      actorId: actor.id,
      action: "notification.sent",
      entityType: "notification",
      entityId: null,
      summary: `Sent a test notification to ${actor.email}`,
    });
  });

  return { messageId };
}

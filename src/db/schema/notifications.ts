import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth";

// One delivered (or pending) notification — the read model behind both email and
// the in-app bell (docs/08). Dispatched from the outbox by the Vercel Cron drain
// (src/modules/notifications/service.ts), never written directly by a request.
//
// `status` is a code-validated text enum (docs/17 §4), not a pg enum, so adding a
// state never needs a migration:
//   QUEUED     — created, awaiting send (EMAIL only)
//   SENT       — handed to Resend (EMAIL) / placed in the inbox (IN_APP, unread)
//   DELIVERED  — Resend webhook confirmed delivery (deferred: webhook not wired yet)
//   BOUNCED    — Resend webhook reported a hard bounce (deferred)
//   COMPLAINED — Resend webhook reported a spam complaint (deferred)
//   FAILED     — send failed past MAX_ATTEMPTS
//   READ       — IN_APP notification the recipient has opened
//
// `recipient_id` is `text` (not uuid) because Better Auth user ids are text — same
// reasoning as audit_logs.actor_id.
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventKey: text("event_key").notNull(),
    recipientId: text("recipient_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(), // EMAIL | IN_APP
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    status: text("status").notNull().default("QUEUED"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    // When the row next becomes eligible for a send attempt (exponential backoff).
    // Null = eligible now.
    nextAttemptAt: timestamp("next_attempt_at"),
    // De-dup guard: one logical event can't fan out to duplicate rows for the same
    // recipient + channel. Built in src/modules/notifications/domain.ts.
    idempotencyKey: text("idempotency_key").notNull(),
    resendMessageId: text("resend_message_id"),
    // The affected entity, so a bell item / email can deep-link back.
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    sentAt: timestamp("sent_at"),
    deliveredAt: timestamp("delivered_at"),
    readAt: timestamp("read_at"),
  },
  (t) => [
    uniqueIndex("notifications_idempotency_idx").on(t.idempotencyKey),
    // Bell: a recipient's recent in-app items, newest first.
    index("notifications_recipient_idx").on(t.recipientId, t.status, t.createdAt),
    // Drain: rows due for a send attempt.
    index("notifications_drain_idx").on(t.status, t.nextAttemptAt),
  ],
);

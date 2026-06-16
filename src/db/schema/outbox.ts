import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Durable event/job outbox drained by Vercel Cron (docs/16 §6). Domain events are
// written here in the same transaction as the action, then dispatched async so a
// mail/job failure never breaks the originating write.
export const outbox = pgTable(
  "outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull(),
    status: text("status").notNull().default("QUEUED"), // QUEUED | SENT | FAILED
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    processedAt: timestamp("processed_at"),
  },
  (t) => [index("outbox_status_idx").on(t.status, t.createdAt)],
);

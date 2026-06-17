import { boolean, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Per-event notification config (docs/08 §4) — the data-driven catalog the
// dispatcher reads to decide whether an event notifies, who, and how. One row per
// event key (src/lib/notification-events.ts); seeded inert (`enabled=false`) so the
// catalog exists but nothing fires until the firm enables an event.
//
// `channels` is a jsonb array of "EMAIL" | "IN_APP". `recipient_rule` is a small
// selector string resolved at dispatch time: "ROLE:ADMIN", "USER:requester", … .
// `mode` IMMEDIATE | DIGEST (DIGEST aggregation is deferred — column reserved).
export const notificationSettings = pgTable("notification_settings", {
  eventKey: text("event_key").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  channels: jsonb("channels")
    .notNull()
    .default(sql`'["IN_APP"]'::jsonb`),
  recipientRule: text("recipient_rule"),
  mode: text("mode").notNull().default("IMMEDIATE"), // IMMEDIATE | DIGEST
  digestWindow: text("digest_window"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

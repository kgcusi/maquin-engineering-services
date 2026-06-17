import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Admin-editable app configuration (docs/02 §2.4) — a small key/value store, the
// only firm config that stays runtime-editable (option lists / statuses / units /
// trades are code-owned, docs/17 §9). One row per setting key; `value` is jsonb.
// Read through the cached getSettings() (src/modules/settings/queries.ts); written
// only via the guarded settings action. Access is WEBMASTER-only (docs/17, RBAC).
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

import { integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

// Year-scoped sequential counters behind human-readable reference codes
// (e.g. MR-2026-00042). Incremented atomically inside a transaction via
// src/lib/refcodes.ts. docs/01 §5.6.
export const refCounters = pgTable(
  "ref_counters",
  {
    prefix: text("prefix").notNull(),
    year: integer("year").notNull(),
    currentValue: integer("current_value").notNull().default(0),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.prefix, t.year] })],
);

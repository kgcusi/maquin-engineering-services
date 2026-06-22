import { sql } from "drizzle-orm";
import { check, date, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { percentColumn } from "@/lib/money";

import { projects } from "./projects";

// A phase groups tasks within a project (docs/02 §4.3). Status is DERIVED from
// progress, never stored. `progress_pct` is the average of its tasks' progress,
// recomputed on each task write (docs/17 §10.3). `sequence` drives ordered display.
export const phases = pgTable(
  "phases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sequence: integer("sequence").notNull().default(0),
    startDate: date("start_date"),
    targetEndDate: date("target_end_date"),
    progressPct: percentColumn("progress_pct").notNull().default(0),
    remarks: text("remarks"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [
    index("phases_project_seq_idx").on(t.projectId, t.sequence),
    check("phases_progress_pct_check", sql`${t.progressPct} between 0 and 100`),
  ],
);

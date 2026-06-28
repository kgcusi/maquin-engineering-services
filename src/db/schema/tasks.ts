import { sql } from "drizzle-orm";
import { boolean, check, date, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { percentColumn } from "@/lib/money";

import { phases } from "./phases";
import { user } from "./auth";

// A task is the leaf of the project hierarchy (docs/02 §4.4). `progress_pct` is the
// SINGLE engineer input; status is derived from it (0→Not Started, 1–99→In
// Progress, 100→Done). Schedule is tracked as target vs actual: `target_start_date`/
// `target_end_date` are the plan; `actual_start_date`/`actual_end_date` are recorded
// manually (the status control prompts for them on transition — never auto-stamped).
// `is_blocked` is an orthogonal flag. `is_delayed` is a STORED transition flag written
// ONLY by the nightly job (docs/17 §10.7) — the read path derives "delayed" (open task
// past its target end) for display and never writes it. The partial index backs the scan.
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phaseId: uuid("phase_id")
      .notNull()
      .references(() => phases.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    assigneeId: text("assignee_id").references(() => user.id, { onDelete: "set null" }),
    targetStartDate: date("target_start_date", { mode: "string" }),
    targetEndDate: date("target_end_date", { mode: "string" }),
    actualStartDate: date("actual_start_date", { mode: "string" }),
    actualEndDate: date("actual_end_date", { mode: "string" }),
    progressPct: percentColumn("progress_pct").notNull().default(0),
    // Share of the phase this task carries (an allocation, 0–100). Phase progress is
    // the weight-weighted average of task completion; weight 0 = unallocated (ignored
    // by the roll-up) and the default, so existing data falls back to a plain average.
    weightPct: percentColumn("weight_pct").notNull().default(0),
    isBlocked: boolean("is_blocked").notNull().default(false),
    blockedReason: text("blocked_reason"),
    isDelayed: boolean("is_delayed").notNull().default(false),
    delayedNotifiedAt: timestamp("delayed_notified_at"),
    remarks: text("remarks"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [
    index("tasks_phase_idx").on(t.phaseId),
    index("tasks_assignee_idx").on(t.assigneeId),
    // Nightly delay scan: open tasks only, looked up by target end date. The index
    // name is kept (tasks_due_open_idx) even though the column was renamed.
    index("tasks_due_open_idx")
      .on(t.targetEndDate)
      .where(sql`${t.progressPct} < 100`),
    check("tasks_progress_pct_check", sql`${t.progressPct} between 0 and 100`),
    check("tasks_weight_pct_check", sql`${t.weightPct} between 0 and 100`),
  ],
);

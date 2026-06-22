import { sql } from "drizzle-orm";
import { boolean, check, date, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { percentColumn } from "@/lib/money";

import { phases } from "./phases";
import { user } from "./auth";

// A task is the leaf of the project hierarchy (docs/02 §4.4). `progress_pct` is the
// SINGLE engineer input; status is derived from it (0→Not Started, 1–99→In
// Progress, 100→Done) and `completed_date` is stamped at 100. `is_blocked` is an
// orthogonal flag. `is_delayed` is a STORED transition flag written ONLY by the
// nightly job (docs/17 §10.7) — the read path derives "delayed" for display and
// never writes it. The partial index backs the nightly past-due scan.
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phaseId: uuid("phase_id")
      .notNull()
      .references(() => phases.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    assigneeId: text("assignee_id").references(() => user.id, { onDelete: "set null" }),
    startDate: date("start_date"),
    dueDate: date("due_date"),
    completedDate: date("completed_date"),
    progressPct: percentColumn("progress_pct").notNull().default(0),
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
    // Nightly delay scan: open tasks only, looked up by due date.
    index("tasks_due_open_idx")
      .on(t.dueDate)
      .where(sql`${t.progressPct} < 100`),
    check("tasks_progress_pct_check", sql`${t.progressPct} between 0 and 100`),
  ],
);

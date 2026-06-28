import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { INSPECTION_ITEM_RESULTS, INSPECTION_STATUSES } from "@/lib/statuses";

import { inspections } from "./inspections";
import { user } from "./auth";

// Re-inspection = reopen in place + append-only history (docs/17 §10.16). Every
// recording on an inspection appends ONE inspection_attempts row (with its
// snapshotted item results); the inspection's status/outcomeRemarks reflect the
// LATEST attempt. So a FAILED inspection is re-inspected on the same record while
// keeping a full attempt timeline — no new request, no new record.
//
// `outcome` reuses the inspection status spellings but only the terminal pair
// (PASSED/FAILED) is ever written here; the enum is shared to keep spellings
// single-sourced.
export const inspectionItemResultEnum = pgEnum("inspection_item_result", INSPECTION_ITEM_RESULTS);
export const inspectionAttemptOutcomeEnum = pgEnum(
  "inspection_attempt_outcome",
  INSPECTION_STATUSES,
);

export const inspectionAttempts = pgTable(
  "inspection_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    inspectionId: uuid("inspection_id")
      .notNull()
      .references(() => inspections.id, { onDelete: "cascade" }),
    attemptNo: integer("attempt_no").notNull(), // 1-based, server-assigned (max+1 in-tx)
    outcome: inspectionAttemptOutcomeEnum("outcome").notNull(), // PASSED | FAILED
    remarks: text("remarks"),
    recordedById: text("recorded_by_id").references(() => user.id, { onDelete: "set null" }),
    recordedAt: timestamp("recorded_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("inspection_attempts_inspection_idx").on(t.inspectionId, t.attemptNo)],
);

// Per-attempt snapshot of the checklist. `label` is copied from the preset item so
// later preset edits never rewrite history. Per-item photos attach via the
// polymorphic `attachments` table (entity_type='inspection_item_result').
export const inspectionItemResults = pgTable(
  "inspection_item_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => inspectionAttempts.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    result: inspectionItemResultEnum("result").notNull(), // PASS | FAIL | NA
    remarks: text("remarks"),
    sequence: integer("sequence").notNull().default(0),
  },
  (t) => [index("inspection_item_results_attempt_idx").on(t.attemptId, t.sequence)],
);

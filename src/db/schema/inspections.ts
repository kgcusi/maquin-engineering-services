import { date, index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { INSPECTION_STATUSES } from "@/lib/statuses";

import { inspectionChecklists } from "./inspection-checklists";
import { projects } from "./projects";
import { user } from "./auth";

// QA/QC inspection (docs/17 §10.9–10.10). A project-scoped record shown on its own
// "Inspections" tab — NOT bound to a task or phase. An engineer raises a REQUEST
// naming a QA/QC engineer (which grants that user INSPECTOR membership on the
// project), and the inspector records the outcome — PASSED or FAILED (+remarks).
// Advisory: an outcome never gates task/project completion. Photos/attachments, if
// ever needed, live in the polymorphic `attachments` table (entity_type='inspection').
export const inspectionStatusEnum = pgEnum("inspection_status", INSPECTION_STATUSES);

export const inspections = pgTable(
  "inspections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    refCode: text("ref_code").notNull().unique(), // INS-YYYY-NNNNN
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    area: text("area"),
    description: text("description"),
    scheduledFor: date("scheduled_for"),
    inspectorId: text("inspector_id").references(() => user.id, { onDelete: "set null" }),
    requestedById: text("requested_by_id").references(() => user.id, { onDelete: "set null" }),
    // Preset chosen by QA/QC at inspection time; null = free-form pass/fail. Set null
    // on delete so removing a preset never orphans a recorded inspection (item results
    // snapshot their labels anyway).
    checklistId: uuid("checklist_id").references(() => inspectionChecklists.id, {
      onDelete: "set null",
    }),
    status: inspectionStatusEnum("status").notNull().default("REQUESTED"),
    outcomeRemarks: text("outcome_remarks"),
    requestedAt: timestamp("requested_at").defaultNow().notNull(),
    inspectedAt: timestamp("inspected_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [
    index("inspections_project_idx").on(t.projectId),
    index("inspections_inspector_idx").on(t.inspectorId),
  ],
);

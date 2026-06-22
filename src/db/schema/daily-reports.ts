import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { quantityColumn } from "@/lib/money";
import { DSR_ISSUE_SEVERITIES, DSR_STATUSES } from "@/lib/statuses";

import { employees } from "./employees";
import { projects } from "./projects";
import { user } from "./auth";

// Daily Site Report (docs/02 §4.5, docs/17 §10.5–10.6). One per (project, date) —
// the unique index makes "today's report already exists" a cheap up-front lookup,
// so the UI resumes/locks instead of failing at submit. DRAFT is the autosaved
// working copy; SUBMITTED locks it (admin re-opens, audited). Photos live in the
// polymorphic `attachments` table (entity_type='daily_report'), not here.
export const dailyReportStatusEnum = pgEnum("daily_report_status", DSR_STATUSES);
export const dsrIssueSeverityEnum = pgEnum("dsr_issue_severity", DSR_ISSUE_SEVERITIES);

export const dailyReports = pgTable(
  "daily_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    refCode: text("ref_code").notNull().unique(), // DSR-YYYY-NNNNN
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    reportDate: date("report_date").notNull(),
    weather: text("weather"),
    workAccomplished: text("work_accomplished"),
    nextDayPlan: text("next_day_plan"),
    progressNote: text("progress_note"),
    status: dailyReportStatusEnum("status").notNull().default("DRAFT"),
    submittedBy: text("submitted_by").references(() => user.id, { onDelete: "set null" }),
    submittedAt: timestamp("submitted_at"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [
    uniqueIndex("daily_reports_project_date_unique").on(t.projectId, t.reportDate),
    index("daily_reports_project_idx").on(t.projectId),
    index("daily_reports_submitted_by_idx").on(t.submittedBy),
  ],
);

// ── DSR child line-items. Owned by the report; edited as a set while DRAFT. ────

export const dsrManpower = pgTable(
  "dsr_manpower",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dailyReportId: uuid("daily_report_id")
      .notNull()
      .references(() => dailyReports.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id").references(() => employees.id, { onDelete: "set null" }),
    tradeCode: text("trade_code"), // validated against TRADES in code
    headcount: integer("headcount").notNull().default(1),
    hours: quantityColumn("hours"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("dsr_manpower_report_idx").on(t.dailyReportId)],
);

export const dsrEquipment = pgTable(
  "dsr_equipment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dailyReportId: uuid("daily_report_id")
      .notNull()
      .references(() => dailyReports.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    quantity: quantityColumn("quantity").notNull(),
    hours: quantityColumn("hours"),
    remarks: text("remarks"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("dsr_equipment_report_idx").on(t.dailyReportId)],
);

// `dsr_materials.id` is the STABLE uuid the Stage-3 ledger posts −USAGE against
// (source_type='dsr_material', source_id=this id). Edits to a submitted DSR will
// create NEW rows (new ids) so the reversal target never moves (docs/17 §10.4).
// `item_id` is reserved for the Stage-3 inventory link — intentionally NO FK yet
// (the items table doesn't exist until Stage 3).
export const dsrMaterials = pgTable(
  "dsr_materials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dailyReportId: uuid("daily_report_id")
      .notNull()
      .references(() => dailyReports.id, { onDelete: "cascade" }),
    itemId: uuid("item_id"), // reserved (Stage 3); no FK yet
    description: text("description"),
    quantity: quantityColumn("quantity").notNull(),
    unitCode: text("unit_code"), // validated against UNITS in code
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("dsr_materials_report_idx").on(t.dailyReportId)],
);

export const dsrIssues = pgTable(
  "dsr_issues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dailyReportId: uuid("daily_report_id")
      .notNull()
      .references(() => dailyReports.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    severity: dsrIssueSeverityEnum("severity").notNull().default("LOW"),
    resolved: boolean("resolved").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("dsr_issues_report_idx").on(t.dailyReportId)],
);

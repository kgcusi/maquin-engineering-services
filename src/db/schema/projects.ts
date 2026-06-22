import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { moneyColumn, percentColumn } from "@/lib/money";
import { PROJECT_STATUSES } from "@/lib/statuses";

import { clients } from "./clients";
import { user } from "./auth";

// A construction project for a client (docs/02 §4.1). `status` is a STORED
// lifecycle (manual sign-off, never derived). `progress_pct` is denormalized: it
// rolls up from phases→tasks on every task write (docs/17 §10.3), unless
// `progress_is_manual` pins it. `lead_engineer_id` is a display/notification label
// only — the access grant is the `project_members` row, not this column.
export const projectStatusEnum = pgEnum("project_status", PROJECT_STATUSES);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    refCode: text("ref_code").notNull().unique(), // PRJ-YYYY-NNNNN
    name: text("name").notNull(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    location: text("location"),
    contractAmount: moneyColumn("contract_amount"),
    startDate: date("start_date"),
    targetEndDate: date("target_end_date"),
    actualEndDate: date("actual_end_date"), // set on COMPLETED (human sign-off)
    scopeOfWork: text("scope_of_work"),
    leadEngineerId: text("lead_engineer_id").references(() => user.id, { onDelete: "set null" }),
    status: projectStatusEnum("status").notNull().default("PLANNING"),
    defectsLiabilityUntil: date("defects_liability_until"), // "in warranty" is derived
    progressPct: percentColumn("progress_pct").notNull().default(0),
    progressIsManual: boolean("progress_is_manual").notNull().default(false),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [
    index("projects_name_idx").on(t.name),
    index("projects_client_idx").on(t.clientId),
    index("projects_status_idx").on(t.status),
    index("projects_lead_idx").on(t.leadEngineerId),
    check("projects_progress_pct_check", sql`${t.progressPct} between 0 and 100`),
  ],
);

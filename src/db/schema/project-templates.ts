import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { percentColumn } from "@/lib/money";

import { user } from "./auth";

// Admin-authored project skeletons (docs/02 §4.6, docs/17 §10.17). A template carries
// phases (each with a calendar-day duration) and tasks (each with a weight). Creating a
// project "from a template" clones the tree and computes a sequential calendar-day
// schedule from one start date — a SNAPSHOT, so editing the project never touches the
// template. Tasks carry NO dates (phase-level scheduling only, v1).
export const projectTemplates = pgTable(
  "project_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [index("project_templates_name_idx").on(t.name)],
);

export const projectTemplatePhases = pgTable(
  "project_template_phases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => projectTemplates.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sequence: integer("sequence").notNull().default(0),
    // Calendar days; chained at instantiation, adjustable at the review step (>= 1).
    durationDays: integer("duration_days").notNull().default(7),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("project_template_phases_template_idx").on(t.templateId, t.sequence),
    check("project_template_phases_duration_check", sql`${t.durationDays} >= 1`),
  ],
);

export const projectTemplateTasks = pgTable(
  "project_template_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templatePhaseId: uuid("template_phase_id")
      .notNull()
      .references(() => projectTemplatePhases.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sequence: integer("sequence").notNull().default(0),
    // Copied verbatim to tasks.weight_pct; share of the phase (0–100).
    weightPct: percentColumn("weight_pct").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("project_template_tasks_phase_idx").on(t.templatePhaseId, t.sequence),
    check("project_template_tasks_weight_check", sql`${t.weightPct} between 0 and 100`),
  ],
);

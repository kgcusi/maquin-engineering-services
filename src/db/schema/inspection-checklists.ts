import { boolean, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth";

// Admin-authored preset checklists (docs/02 §4.5.1, docs/17 §10.16). The QA/QC
// engineer picks one BY CATEGORY at inspection time; its items are copied
// (snapshotted) onto each attempt, so editing a preset never alters a recorded
// inspection. Inactive presets are hidden from the inspection picker.
export const inspectionChecklists = pgTable(
  "inspection_checklists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    category: text("category"), // grouping for the picker (e.g. Concrete, Electrical)
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [index("inspection_checklists_name_idx").on(t.name)],
);

export const inspectionChecklistItems = pgTable(
  "inspection_checklist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    checklistId: uuid("checklist_id")
      .notNull()
      .references(() => inspectionChecklists.id, { onDelete: "cascade" }),
    label: text("label").notNull(), // the line the inspector marks PASS/FAIL/N-A
    guidance: text("guidance"), // optional "what to look for"
    sequence: integer("sequence").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("inspection_checklist_items_checklist_idx").on(t.checklistId, t.sequence)],
);

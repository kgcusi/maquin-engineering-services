import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { files } from "./files";

// One polymorphic table links files to any domain entity — clients, projects,
// tasks, expenses, DSRs (docs/17 §1). Domain entities use uuid PKs, so entity_id
// is uuid (docs/17 §4).
export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    label: text("label"),
    kind: text("kind"),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("attachments_entity_idx").on(t.entityType, t.entityId)],
);

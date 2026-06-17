import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Client directory (docs/02 §3.2). Documents and notes live in the POLYMORPHIC
// attachments/notes tables (entity_type='client', docs/17 §1) — not dedicated
// child tables. Project history is derived from projects.client_id once projects
// exist (Stage 2). Soft-delete only (deleted_at): a client with projects can't be
// hard-deleted. The freeform `notes` column is inline "remarks"; the timestamped,
// authored Notes log is the polymorphic `notes` table.
export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    contactPerson: text("contact_person"),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [index("clients_name_idx").on(t.name)],
);

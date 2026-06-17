import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Supplier/vendor directory (docs/02 §3.3) — referenced by stock-in (Stage 3) and
// expenses (Stage 4). Soft-delete only (deleted_at); a referenced supplier can't be
// hard-deleted. tin/payment_terms are free text (no validation beyond length).
export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    contactPerson: text("contact_person"),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    tin: text("tin"),
    paymentTerms: text("payment_terms"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [index("suppliers_name_idx").on(t.name)],
);

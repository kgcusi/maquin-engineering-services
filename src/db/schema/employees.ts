import { boolean, date, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { moneyColumn } from "@/lib/money";

// Workforce directory (docs/02 §3.1) — people on site (who reported, received,
// worked) and the base for a future HR/Payroll module. Not every employee is a
// system user. `position` is a free value (creatable picker in the UI);
// `employment_type`/`rate_unit` are validated in code against lookups.ts. `rate`
// is an optional pay rate (DECIMAL(14,2) Money VO — payroll extends this later).
// Documents (contracts, IDs) + notes live in the polymorphic attachments/notes
// tables (entity_type='employee'). Delete is a soft delete via deleted_at (kept
// consistent with clients/suppliers — Edit + Delete only). `is_active` is reserved
// for the future HR module (employed vs separated); not surfaced in the UI yet.
export const employees = pgTable(
  "employees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fullName: text("full_name").notNull(),
    position: text("position"),
    employmentType: text("employment_type"),
    dateHired: date("date_hired"),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    rate: moneyColumn("rate"),
    rateUnit: text("rate_unit").default("DAILY").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [index("employees_full_name_idx").on(t.fullName)],
);

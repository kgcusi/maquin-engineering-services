import { asc, desc, eq, isNotNull, isNull } from "drizzle-orm";

import { db } from "@/db/client";
import { employees } from "@/db/schema/employees";
import { listAttachments } from "@/modules/files/service";
import { listNotes } from "@/modules/notes/service";

export type EmployeeRow = {
  id: string;
  fullName: string;
  position: string | null;
  employmentType: string | null;
  dateHired: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  rate: string | null; // DECIMAL(14,2) as a plain string (client-safe; no Money on the client)
  rateUnit: string;
  notes: string | null;
  isActive: boolean;
  deletedAt: Date | null;
  createdAt: Date;
};

const COLUMNS = {
  id: employees.id,
  fullName: employees.fullName,
  position: employees.position,
  employmentType: employees.employmentType,
  dateHired: employees.dateHired,
  phone: employees.phone,
  email: employees.email,
  address: employees.address,
  rate: employees.rate,
  rateUnit: employees.rateUnit,
  notes: employees.notes,
  isActive: employees.isActive,
  deletedAt: employees.deletedAt,
  createdAt: employees.createdAt,
} as const;

// Money lives server-side only; expose the rate to clients as a decimal string.
type RawRow = { rate: { toDecimalString(): string } | null } & Omit<EmployeeRow, "rate">;
const toRow = (r: RawRow): EmployeeRow => ({
  ...r,
  rate: r.rate ? r.rate.toDecimalString() : null,
});

// Active employees only (soft-deleted are hidden). Newest first.
export async function listEmployees(): Promise<EmployeeRow[]> {
  const rows = await db
    .select(COLUMNS)
    .from(employees)
    .where(isNull(employees.deletedAt))
    .orderBy(desc(employees.createdAt));
  return rows.map(toRow);
}

export async function getEmployeeById(id: string): Promise<EmployeeRow | null> {
  const [row] = await db.select(COLUMNS).from(employees).where(eq(employees.id, id)).limit(1);
  return row ? toRow(row) : null;
}

// Distinct existing positions — feeds the creatable Position picker.
export async function listEmployeePositions(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ position: employees.position })
    .from(employees)
    .where(isNotNull(employees.position))
    .orderBy(asc(employees.position));
  return rows.map((r) => r.position).filter((p): p is string => Boolean(p));
}

export const EMPLOYEE_ENTITY = "employee" as const;
export const getEmployeeDocuments = (id: string) => listAttachments(db, EMPLOYEE_ENTITY, id);
export const getEmployeeNotes = (id: string) => listNotes(db, EMPLOYEE_ENTITY, id);

import { and, asc, count, desc, eq, isNotNull, isNull } from "drizzle-orm";

import { db } from "@/db/client";
import { employees } from "@/db/schema/employees";
import { listAttachments } from "@/modules/files/service";
import { listNotes } from "@/modules/notes/service";
import {
  offsetFor,
  PAGE_SIZE,
  PANEL_PAGE_SIZE,
  searchClause,
  type DirectoryListParams,
  type Paginated,
} from "@/modules/shared/list-params";

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

// Directory list: every non-deleted employee (both active AND inactive), newest
// first, one page at a time with an optional name/position/contact search —
// admins manage status here, so inactive rows stay visible with a badge. Sibling
// COUNT(*) powers the numbered footer.
// CONVENTION: selection pickers in other modules must filter active-only with
// `and(isNull(employees.deletedAt), eq(employees.isActive, true))`.
export async function listEmployees(params: DirectoryListParams): Promise<Paginated<EmployeeRow>> {
  const where = and(
    isNull(employees.deletedAt),
    searchClause(params.q, [
      employees.fullName,
      employees.position,
      employees.email,
      employees.phone,
    ]),
  );

  const [rows, [{ value: total }]] = await Promise.all([
    db
      .select(COLUMNS)
      .from(employees)
      .where(where)
      .orderBy(desc(employees.createdAt))
      .limit(PAGE_SIZE)
      .offset(offsetFor(params.page, PAGE_SIZE)),
    db.select({ value: count() }).from(employees).where(where),
  ]);

  return { rows: rows.map(toRow), total, page: params.page, pageSize: PAGE_SIZE };
}

export async function getEmployeeById(id: string): Promise<EmployeeRow | null> {
  const [row] = await db.select(COLUMNS).from(employees).where(eq(employees.id, id)).limit(1);
  return row ? toRow(row) : null;
}

// All active employee names — feeds the import dialog's duplicate warning, which
// must compare against every existing employee, not just the current page.
export async function listEmployeeNames(): Promise<string[]> {
  const rows = await db
    .select({ fullName: employees.fullName })
    .from(employees)
    .where(isNull(employees.deletedAt));
  return rows.map((r) => r.fullName);
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
export const getEmployeeDocuments = (id: string, page: number) =>
  listAttachments(db, EMPLOYEE_ENTITY, id, page, PANEL_PAGE_SIZE);
export const getEmployeeNotes = (id: string, page: number) =>
  listNotes(db, EMPLOYEE_ENTITY, id, page, PANEL_PAGE_SIZE);

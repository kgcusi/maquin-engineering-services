import { and, count, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/db/client";
import { suppliers } from "@/db/schema/suppliers";
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

export type SupplierRow = {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  tin: string | null;
  paymentTerms: string | null;
  isActive: boolean;
  notes: string | null;
  deletedAt: Date | null;
  createdAt: Date;
};

const COLUMNS = {
  id: suppliers.id,
  name: suppliers.name,
  contactPerson: suppliers.contactPerson,
  phone: suppliers.phone,
  email: suppliers.email,
  address: suppliers.address,
  tin: suppliers.tin,
  paymentTerms: suppliers.paymentTerms,
  isActive: suppliers.isActive,
  notes: suppliers.notes,
  deletedAt: suppliers.deletedAt,
  createdAt: suppliers.createdAt,
} as const;

// Directory list: every non-deleted supplier (both active AND inactive), newest
// first, one page at a time with an optional name/contact/email search — admins
// manage status here, so inactive rows stay visible with a badge. Sibling
// COUNT(*) powers the numbered footer.
// CONVENTION: selection pickers in other modules must filter active-only with
// `and(isNull(suppliers.deletedAt), eq(suppliers.isActive, true))`.
export async function listSuppliers(params: DirectoryListParams): Promise<Paginated<SupplierRow>> {
  const where = and(
    isNull(suppliers.deletedAt),
    searchClause(params.q, [suppliers.name, suppliers.contactPerson, suppliers.email]),
  );

  const [rows, [{ value: total }]] = await Promise.all([
    db
      .select(COLUMNS)
      .from(suppliers)
      .where(where)
      .orderBy(desc(suppliers.createdAt))
      .limit(PAGE_SIZE)
      .offset(offsetFor(params.page, PAGE_SIZE)),
    db.select({ value: count() }).from(suppliers).where(where),
  ]);

  return { rows, total, page: params.page, pageSize: PAGE_SIZE };
}

export async function getSupplierById(id: string): Promise<SupplierRow | null> {
  const [row] = await db.select(COLUMNS).from(suppliers).where(eq(suppliers.id, id)).limit(1);
  return row ?? null;
}

// All active supplier names — feeds the import dialog's duplicate warning, which
// must compare against every existing supplier, not just the current page.
export async function listSupplierNames(): Promise<string[]> {
  const rows = await db
    .select({ name: suppliers.name })
    .from(suppliers)
    .where(isNull(suppliers.deletedAt));
  return rows.map((r) => r.name);
}

// Detail-tab data over the polymorphic tables (entity_type = "supplier"), one
// page per tab (namespaced ?docsPage / ?notesPage on the detail route).
export const SUPPLIER_ENTITY = "supplier" as const;
export const getSupplierDocuments = (supplierId: string, page: number) =>
  listAttachments(db, SUPPLIER_ENTITY, supplierId, page, PANEL_PAGE_SIZE);
export const getSupplierNotes = (supplierId: string, page: number) =>
  listNotes(db, SUPPLIER_ENTITY, supplierId, page, PANEL_PAGE_SIZE);

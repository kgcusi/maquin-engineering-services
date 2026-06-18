import { and, count, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/db/client";
import { clients } from "@/db/schema/clients";
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

export type ClientRow = {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  deletedAt: Date | null;
  createdAt: Date;
};

const COLUMNS = {
  id: clients.id,
  name: clients.name,
  contactPerson: clients.contactPerson,
  phone: clients.phone,
  email: clients.email,
  address: clients.address,
  notes: clients.notes,
  deletedAt: clients.deletedAt,
  createdAt: clients.createdAt,
} as const;

// Active clients only (soft-deleted are hidden), newest first, one page at a
// time with an optional case-insensitive name/contact/email search. The sibling
// COUNT(*) over the same WHERE powers the numbered footer.
export async function listClients(params: DirectoryListParams): Promise<Paginated<ClientRow>> {
  const where = and(
    isNull(clients.deletedAt),
    searchClause(params.q, [clients.name, clients.contactPerson, clients.email]),
  );

  const [rows, [{ value: total }]] = await Promise.all([
    db
      .select(COLUMNS)
      .from(clients)
      .where(where)
      .orderBy(desc(clients.createdAt))
      .limit(PAGE_SIZE)
      .offset(offsetFor(params.page, PAGE_SIZE)),
    db.select({ value: count() }).from(clients).where(where),
  ]);

  return { rows, total, page: params.page, pageSize: PAGE_SIZE };
}

export async function getClientById(id: string): Promise<ClientRow | null> {
  const [row] = await db.select(COLUMNS).from(clients).where(eq(clients.id, id)).limit(1);
  return row ?? null;
}

// All active client names — feeds the import dialog's duplicate warning, which
// must compare against every existing client, not just the current page.
export async function listClientNames(): Promise<string[]> {
  const rows = await db
    .select({ name: clients.name })
    .from(clients)
    .where(isNull(clients.deletedAt));
  return rows.map((r) => r.name);
}

// Detail-tab data over the polymorphic tables (entity_type = "client"), one page
// per tab (namespaced ?docsPage / ?notesPage on the detail route).
export const CLIENT_ENTITY = "client" as const;
export const getClientDocuments = (clientId: string, page: number) =>
  listAttachments(db, CLIENT_ENTITY, clientId, page, PANEL_PAGE_SIZE);
export const getClientNotes = (clientId: string, page: number) =>
  listNotes(db, CLIENT_ENTITY, clientId, page, PANEL_PAGE_SIZE);

import { desc, eq, isNull } from "drizzle-orm";

import { db } from "@/db/client";
import { clients } from "@/db/schema/clients";
import { listAttachments } from "@/modules/files/service";
import { listNotes } from "@/modules/notes/service";

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

// Active clients only (soft-deleted are hidden). Newest first.
export async function listClients(): Promise<ClientRow[]> {
  return db
    .select(COLUMNS)
    .from(clients)
    .where(isNull(clients.deletedAt))
    .orderBy(desc(clients.createdAt));
}

export async function getClientById(id: string): Promise<ClientRow | null> {
  const [row] = await db.select(COLUMNS).from(clients).where(eq(clients.id, id)).limit(1);
  return row ?? null;
}

// Detail-tab data over the polymorphic tables (entity_type = "client").
export const CLIENT_ENTITY = "client" as const;
export const getClientDocuments = (clientId: string) =>
  listAttachments(db, CLIENT_ENTITY, clientId);
export const getClientNotes = (clientId: string) => listNotes(db, CLIENT_ENTITY, clientId);

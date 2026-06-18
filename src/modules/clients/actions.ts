"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";

import type { Database } from "@/db/client";
import { clients } from "@/db/schema/clients";
import { orNull, requireEntityRef } from "@/lib/action-helpers";
import { audit, diffFields } from "@/lib/audit";
import { ActionError, action, actionNoTx } from "@/lib/rbac";
import {
  confirmAttachment,
  createPendingUpload,
  getAttachmentDownloadUrl,
  removeAttachment,
} from "@/modules/files/service";
import { addNote, removeNote } from "@/modules/notes/service";
import { IMPORT_ROW_LIMIT } from "@/modules/shared/import";

import {
  addClientNoteSchema,
  clientDocumentIdSchema,
  clientIdSchema,
  clientNoteIdSchema,
  confirmClientDocumentSchema,
  createClientSchema,
  type CreateClientInput,
  presignClientDocumentSchema,
  updateClientSchema,
} from "./schema";

const ENTITY = "client";

// Used by the document/note actions to scope to a real client and label the audit.
const requireClientName = (db: Database, id: string) =>
  requireEntityRef(db, {
    label: "Client",
    table: clients,
    idColumn: clients.id,
    nameColumn: clients.name,
    id,
  });

// Single source of truth for create → row mapping, shared by single create and
// bulk import so they stay in lockstep ("" → null on every optional column).
const toClientValues = (input: CreateClientInput) => ({
  name: input.name,
  contactPerson: orNull(input.contactPerson),
  phone: orNull(input.phone),
  email: orNull(input.email),
  address: orNull(input.address),
  notes: orNull(input.notes),
});

// ── Core CRUD ─────────────────────────────────────────────────────────────────
export const createClientAction = action(
  "client.manage",
  createClientSchema,
  async (input, { user: actor, tx }) => {
    const [created] = await tx.insert(clients).values(toClientValues(input)).returning({
      id: clients.id,
    });

    await audit(tx, {
      actorId: actor.id,
      action: "client.created",
      entityType: ENTITY,
      entityId: created.id,
      summary: `Created client ${input.name}`,
      diff: { name: input.name, contactPerson: orNull(input.contactPerson) },
    });

    return { id: created.id };
  },
);

// Bulk create from a validated CSV/XLSX import. Re-validates every row server-side
// (client validation is UX only), inserts them in one statement inside the action's
// transaction, and records ONE audit summary rather than flooding the log per row.
export const bulkCreateClientsAction = action(
  "client.manage",
  z.array(createClientSchema).min(1).max(IMPORT_ROW_LIMIT),
  async (rows, { user: actor, tx }) => {
    await tx.insert(clients).values(rows.map(toClientValues));
    await audit(tx, {
      actorId: actor.id,
      action: "client.imported",
      entityType: ENTITY,
      summary: `Imported ${rows.length} client${rows.length === 1 ? "" : "s"}`,
      diff: { count: rows.length },
    });
    return { count: rows.length };
  },
);

export const updateClientAction = action(
  "client.manage",
  updateClientSchema,
  async (input, { user: actor, tx }) => {
    const [target] = await tx
      .select({
        name: clients.name,
        contactPerson: clients.contactPerson,
        phone: clients.phone,
        email: clients.email,
        address: clients.address,
        notes: clients.notes,
      })
      .from(clients)
      .where(eq(clients.id, input.id))
      .limit(1);
    if (!target) throw new ActionError("Client not found.");

    const next = {
      name: input.name,
      contactPerson: orNull(input.contactPerson),
      phone: orNull(input.phone),
      email: orNull(input.email),
      address: orNull(input.address),
      notes: orNull(input.notes),
    };

    await tx
      .update(clients)
      .set({ ...next, updatedAt: new Date() })
      .where(eq(clients.id, input.id));

    await audit(tx, {
      actorId: actor.id,
      action: "client.updated",
      entityType: ENTITY,
      entityId: input.id,
      summary: `Updated client ${input.name}`,
      diff: diffFields(target, next),
    });

    return { id: input.id };
  },
);

// Soft delete (keeps the row so projects can keep referencing the client) shown
// as a plain "Delete": the client leaves the directory and lists hide it.
export const deleteClientAction = action(
  "client.manage",
  clientIdSchema,
  async (input, { user: actor, tx }) => {
    const [target] = await tx
      .select({ id: clients.id, name: clients.name, deletedAt: clients.deletedAt })
      .from(clients)
      .where(eq(clients.id, input.id))
      .limit(1);
    if (!target) throw new ActionError("Client not found.");
    if (target.deletedAt) return { id: input.id };

    await tx.update(clients).set({ deletedAt: new Date() }).where(eq(clients.id, input.id));
    await audit(tx, {
      actorId: actor.id,
      action: "client.deleted",
      entityType: ENTITY,
      entityId: input.id,
      summary: `Deleted client ${target.name}`,
    });

    return { id: input.id };
  },
);

// ── Documents (reusable file pipeline, scoped to this client) ──────────────────
export const presignClientDocumentAction = actionNoTx(
  "client.manage",
  presignClientDocumentSchema,
  async (input, { user: actor, db }) => {
    await requireClientName(db, input.clientId);
    return createPendingUpload(db, {
      entityType: ENTITY,
      entityId: input.clientId,
      filename: input.filename,
      mime: input.mime,
      size: input.size,
      uploadedBy: actor.id,
    });
  },
);

export const confirmClientDocumentAction = actionNoTx(
  "client.manage",
  confirmClientDocumentSchema,
  async (input, { user: actor, db }) => {
    const name = await requireClientName(db, input.clientId);
    return confirmAttachment(db, {
      fileId: input.fileId,
      entityType: ENTITY,
      entityId: input.clientId,
      label: input.name,
      actorId: actor.id,
      auditAction: "client.document.added",
      auditSummary: `Added a document to ${name}`,
    });
  },
);

export const getClientDocumentUrlAction = actionNoTx(
  "client.view",
  clientDocumentIdSchema,
  async (input, { db }) =>
    getAttachmentDownloadUrl(db, {
      attachmentId: input.attachmentId,
      entityType: ENTITY,
      entityId: input.clientId,
    }),
);

export const deleteClientDocumentAction = actionNoTx(
  "client.manage",
  clientDocumentIdSchema,
  async (input, { user: actor, db }) => {
    const name = await requireClientName(db, input.clientId);
    await removeAttachment(db, {
      attachmentId: input.attachmentId,
      entityType: ENTITY,
      entityId: input.clientId,
      actorId: actor.id,
      auditAction: "client.document.removed",
      auditSummary: `Removed a document from ${name}`,
    });
    return { ok: true };
  },
);

// ── Notes (reusable notes service, scoped to this client) ──────────────────────
export const addClientNoteAction = actionNoTx(
  "client.manage",
  addClientNoteSchema,
  async (input, { user: actor, db }) => {
    const name = await requireClientName(db, input.clientId);
    return addNote(db, {
      entityType: ENTITY,
      entityId: input.clientId,
      body: input.body,
      actorId: actor.id,
      auditAction: "client.note.added",
      auditSummary: `Added a note to ${name}`,
    });
  },
);

export const deleteClientNoteAction = actionNoTx(
  "client.manage",
  clientNoteIdSchema,
  async (input, { user: actor, db }) => {
    const name = await requireClientName(db, input.clientId);
    await removeNote(db, {
      noteId: input.noteId,
      entityType: ENTITY,
      entityId: input.clientId,
      actorId: actor.id,
      auditAction: "client.note.removed",
      auditSummary: `Removed a note from ${name}`,
    });
    return { ok: true };
  },
);

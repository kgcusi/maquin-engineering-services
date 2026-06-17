"use server";

import { eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import { clients } from "@/db/schema/clients";
import { audit } from "@/lib/audit";
import { ActionError, action, actionNoTx } from "@/lib/rbac";
import {
  confirmAttachment,
  createPendingUpload,
  getAttachmentDownloadUrl,
  removeAttachment,
} from "@/modules/files/service";
import { addNote, removeNote } from "@/modules/notes/service";

import {
  addClientNoteSchema,
  clientDocumentIdSchema,
  clientIdSchema,
  clientNoteIdSchema,
  confirmClientDocumentSchema,
  createClientSchema,
  presignClientDocumentSchema,
  updateClientSchema,
} from "./schema";

const ENTITY = "client";
const orNull = (v?: string | null) => (v && v.length ? v : null);

// Used by the document/note actions to scope to a real client and label the audit.
async function requireClientName(db: Database, id: string): Promise<string> {
  const [row] = await db
    .select({ name: clients.name })
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);
  if (!row) throw new ActionError("Client not found.");
  return row.name;
}

// ── Core CRUD ─────────────────────────────────────────────────────────────────
export const createClientAction = action(
  "client.manage",
  createClientSchema,
  async (input, { user: actor, tx }) => {
    const [created] = await tx
      .insert(clients)
      .values({
        name: input.name,
        contactPerson: orNull(input.contactPerson),
        phone: orNull(input.phone),
        email: orNull(input.email),
        address: orNull(input.address),
        notes: orNull(input.notes),
      })
      .returning({ id: clients.id });

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

export const updateClientAction = action(
  "client.manage",
  updateClientSchema,
  async (input, { user: actor, tx }) => {
    const [target] = await tx
      .select({ id: clients.id, name: clients.name })
      .from(clients)
      .where(eq(clients.id, input.id))
      .limit(1);
    if (!target) throw new ActionError("Client not found.");

    await tx
      .update(clients)
      .set({
        name: input.name,
        contactPerson: orNull(input.contactPerson),
        phone: orNull(input.phone),
        email: orNull(input.email),
        address: orNull(input.address),
        notes: orNull(input.notes),
        updatedAt: new Date(),
      })
      .where(eq(clients.id, input.id));

    await audit(tx, {
      actorId: actor.id,
      action: "client.updated",
      entityType: ENTITY,
      entityId: input.id,
      summary: `Updated client ${input.name}`,
      diff: { name: { from: target.name, to: input.name } },
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

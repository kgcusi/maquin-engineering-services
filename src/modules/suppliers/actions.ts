"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";

import type { Database } from "@/db/client";
import { suppliers } from "@/db/schema/suppliers";
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
  addSupplierNoteSchema,
  confirmSupplierDocumentSchema,
  createSupplierSchema,
  type CreateSupplierInput,
  presignSupplierDocumentSchema,
  supplierDocumentIdSchema,
  supplierIdSchema,
  supplierNoteIdSchema,
  updateSupplierSchema,
} from "./schema";

const ENTITY = "supplier";

// Used by the document/note actions to scope to a real supplier and label the audit.
const requireSupplierName = (db: Database, id: string) =>
  requireEntityRef(db, {
    label: "Supplier",
    table: suppliers,
    idColumn: suppliers.id,
    nameColumn: suppliers.name,
    id,
  });

// Shared create → row mapping (single create + bulk import stay in lockstep).
const toSupplierValues = (input: CreateSupplierInput) => ({
  name: input.name,
  contactPerson: orNull(input.contactPerson),
  phone: orNull(input.phone),
  email: orNull(input.email),
  address: orNull(input.address),
  tin: orNull(input.tin),
  paymentTerms: orNull(input.paymentTerms),
  notes: orNull(input.notes),
});

export const createSupplierAction = action(
  "supplier.manage",
  createSupplierSchema,
  async (input, { user: actor, tx }) => {
    const [created] = await tx.insert(suppliers).values(toSupplierValues(input)).returning({
      id: suppliers.id,
    });

    await audit(tx, {
      actorId: actor.id,
      action: "supplier.created",
      entityType: ENTITY,
      entityId: created.id,
      summary: `Created supplier ${input.name}`,
      diff: { name: input.name, contactPerson: orNull(input.contactPerson) },
    });

    return { id: created.id };
  },
);

// Bulk create from a validated CSV/XLSX import — re-validated server-side, one
// statement in the action's transaction, one audit summary entry.
export const bulkCreateSuppliersAction = action(
  "supplier.manage",
  z.array(createSupplierSchema).min(1).max(IMPORT_ROW_LIMIT),
  async (rows, { user: actor, tx }) => {
    await tx.insert(suppliers).values(rows.map(toSupplierValues));
    await audit(tx, {
      actorId: actor.id,
      action: "supplier.imported",
      entityType: ENTITY,
      summary: `Imported ${rows.length} supplier${rows.length === 1 ? "" : "s"}`,
      diff: { count: rows.length },
    });
    return { count: rows.length };
  },
);

export const updateSupplierAction = action(
  "supplier.manage",
  updateSupplierSchema,
  async (input, { user: actor, tx }) => {
    const [target] = await tx
      .select({
        name: suppliers.name,
        contactPerson: suppliers.contactPerson,
        phone: suppliers.phone,
        email: suppliers.email,
        address: suppliers.address,
        tin: suppliers.tin,
        paymentTerms: suppliers.paymentTerms,
        notes: suppliers.notes,
      })
      .from(suppliers)
      .where(eq(suppliers.id, input.id))
      .limit(1);
    if (!target) throw new ActionError("Supplier not found.");

    const next = {
      name: input.name,
      contactPerson: orNull(input.contactPerson),
      phone: orNull(input.phone),
      email: orNull(input.email),
      address: orNull(input.address),
      tin: orNull(input.tin),
      paymentTerms: orNull(input.paymentTerms),
      notes: orNull(input.notes),
    };

    await tx
      .update(suppliers)
      .set({ ...next, updatedAt: new Date() })
      .where(eq(suppliers.id, input.id));

    await audit(tx, {
      actorId: actor.id,
      action: "supplier.updated",
      entityType: ENTITY,
      entityId: input.id,
      summary: `Updated supplier ${input.name}`,
      diff: diffFields(target, next),
    });

    return { id: input.id };
  },
);

// Soft delete (keeps the row for referential integrity once stock-in/expenses
// reference suppliers) — but it reads as a plain "Delete" in the UI; the record
// leaves the directory and lists hide it. No restore.
export const deleteSupplierAction = action(
  "supplier.manage",
  supplierIdSchema,
  async (input, { user: actor, tx }) => {
    const [target] = await tx
      .select({ id: suppliers.id, name: suppliers.name, deletedAt: suppliers.deletedAt })
      .from(suppliers)
      .where(eq(suppliers.id, input.id))
      .limit(1);
    if (!target) throw new ActionError("Supplier not found.");
    if (target.deletedAt) return { id: input.id };

    await tx.update(suppliers).set({ deletedAt: new Date() }).where(eq(suppliers.id, input.id));
    await audit(tx, {
      actorId: actor.id,
      action: "supplier.deleted",
      entityType: ENTITY,
      entityId: input.id,
      summary: `Deleted supplier ${target.name}`,
    });

    return { id: input.id };
  },
);

// ── Documents (reusable file pipeline, scoped to this supplier) ─────────────────
export const presignSupplierDocumentAction = actionNoTx(
  "supplier.manage",
  presignSupplierDocumentSchema,
  async (input, { user: actor, db }) => {
    await requireSupplierName(db, input.supplierId);
    return createPendingUpload(db, {
      entityType: ENTITY,
      entityId: input.supplierId,
      filename: input.filename,
      mime: input.mime,
      size: input.size,
      uploadedBy: actor.id,
    });
  },
);

export const confirmSupplierDocumentAction = actionNoTx(
  "supplier.manage",
  confirmSupplierDocumentSchema,
  async (input, { user: actor, db }) => {
    const name = await requireSupplierName(db, input.supplierId);
    return confirmAttachment(db, {
      fileId: input.fileId,
      entityType: ENTITY,
      entityId: input.supplierId,
      label: input.name,
      actorId: actor.id,
      auditAction: "supplier.document.added",
      auditSummary: `Added a document to ${name}`,
    });
  },
);

export const getSupplierDocumentUrlAction = actionNoTx(
  "supplier.view",
  supplierDocumentIdSchema,
  async (input, { db }) =>
    getAttachmentDownloadUrl(db, {
      attachmentId: input.attachmentId,
      entityType: ENTITY,
      entityId: input.supplierId,
    }),
);

export const deleteSupplierDocumentAction = actionNoTx(
  "supplier.manage",
  supplierDocumentIdSchema,
  async (input, { user: actor, db }) => {
    const name = await requireSupplierName(db, input.supplierId);
    await removeAttachment(db, {
      attachmentId: input.attachmentId,
      entityType: ENTITY,
      entityId: input.supplierId,
      actorId: actor.id,
      auditAction: "supplier.document.removed",
      auditSummary: `Removed a document from ${name}`,
    });
    return { ok: true };
  },
);

// ── Notes (reusable notes service, scoped to this supplier) ─────────────────────
export const addSupplierNoteAction = actionNoTx(
  "supplier.manage",
  addSupplierNoteSchema,
  async (input, { user: actor, db }) => {
    const name = await requireSupplierName(db, input.supplierId);
    return addNote(db, {
      entityType: ENTITY,
      entityId: input.supplierId,
      body: input.body,
      actorId: actor.id,
      auditAction: "supplier.note.added",
      auditSummary: `Added a note to ${name}`,
    });
  },
);

export const deleteSupplierNoteAction = actionNoTx(
  "supplier.manage",
  supplierNoteIdSchema,
  async (input, { user: actor, db }) => {
    const name = await requireSupplierName(db, input.supplierId);
    await removeNote(db, {
      noteId: input.noteId,
      entityType: ENTITY,
      entityId: input.supplierId,
      actorId: actor.id,
      auditAction: "supplier.note.removed",
      auditSummary: `Removed a note from ${name}`,
    });
    return { ok: true };
  },
);

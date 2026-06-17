"use server";

import { eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import { employees } from "@/db/schema/employees";
import { audit } from "@/lib/audit";
import { Money } from "@/lib/money";
import { ActionError, action, actionNoTx } from "@/lib/rbac";
import {
  confirmAttachment,
  createPendingUpload,
  getAttachmentDownloadUrl,
  removeAttachment,
} from "@/modules/files/service";
import { addNote, removeNote } from "@/modules/notes/service";

import {
  addEmployeeNoteSchema,
  confirmEmployeeDocumentSchema,
  createEmployeeSchema,
  employeeDocumentIdSchema,
  employeeIdSchema,
  employeeNoteIdSchema,
  presignEmployeeDocumentSchema,
  updateEmployeeSchema,
} from "./schema";

const ENTITY = "employee";
const orNull = (v?: string | null) => (v && v.length ? v : null);
const toRate = (v?: string) => (v && v.length ? Money.fromDecimal(v) : null);

async function requireEmployeeName(db: Database, id: string): Promise<string> {
  const [row] = await db
    .select({ name: employees.fullName })
    .from(employees)
    .where(eq(employees.id, id))
    .limit(1);
  if (!row) throw new ActionError("Employee not found.");
  return row.name;
}

export const createEmployeeAction = action(
  "employee.manage",
  createEmployeeSchema,
  async (input, { user: actor, tx }) => {
    const [created] = await tx
      .insert(employees)
      .values({
        fullName: input.fullName,
        position: orNull(input.position),
        employmentType: orNull(input.employmentType),
        dateHired: orNull(input.dateHired),
        phone: orNull(input.phone),
        email: orNull(input.email),
        address: orNull(input.address),
        rate: toRate(input.rate),
        rateUnit: input.rateUnit,
        notes: orNull(input.notes),
      })
      .returning({ id: employees.id });

    await audit(tx, {
      actorId: actor.id,
      action: "employee.created",
      entityType: ENTITY,
      entityId: created.id,
      summary: `Created employee ${input.fullName}`,
      diff: { fullName: input.fullName, position: orNull(input.position) },
    });

    return { id: created.id };
  },
);

export const updateEmployeeAction = action(
  "employee.manage",
  updateEmployeeSchema,
  async (input, { user: actor, tx }) => {
    const [target] = await tx
      .select({ id: employees.id, fullName: employees.fullName })
      .from(employees)
      .where(eq(employees.id, input.id))
      .limit(1);
    if (!target) throw new ActionError("Employee not found.");

    await tx
      .update(employees)
      .set({
        fullName: input.fullName,
        position: orNull(input.position),
        employmentType: orNull(input.employmentType),
        dateHired: orNull(input.dateHired),
        phone: orNull(input.phone),
        email: orNull(input.email),
        address: orNull(input.address),
        rate: toRate(input.rate),
        rateUnit: input.rateUnit,
        notes: orNull(input.notes),
        updatedAt: new Date(),
      })
      .where(eq(employees.id, input.id));

    await audit(tx, {
      actorId: actor.id,
      action: "employee.updated",
      entityType: ENTITY,
      entityId: input.id,
      summary: `Updated employee ${input.fullName}`,
      diff: { fullName: { from: target.fullName, to: input.fullName } },
    });

    return { id: input.id };
  },
);

// Soft delete (keeps the row so DSR manpower / user links can keep referencing the
// employee) shown as a plain "Delete": the employee leaves the directory.
export const deleteEmployeeAction = action(
  "employee.manage",
  employeeIdSchema,
  async (input, { user: actor, tx }) => {
    const [target] = await tx
      .select({ id: employees.id, fullName: employees.fullName, deletedAt: employees.deletedAt })
      .from(employees)
      .where(eq(employees.id, input.id))
      .limit(1);
    if (!target) throw new ActionError("Employee not found.");
    if (target.deletedAt) return { id: input.id };

    await tx.update(employees).set({ deletedAt: new Date() }).where(eq(employees.id, input.id));
    await audit(tx, {
      actorId: actor.id,
      action: "employee.deleted",
      entityType: ENTITY,
      entityId: input.id,
      summary: `Deleted employee ${target.fullName}`,
    });

    return { id: input.id };
  },
);

// ── Documents (typed, via the reusable file pipeline) ──────────────────────────
export const presignEmployeeDocumentAction = actionNoTx(
  "employee.manage",
  presignEmployeeDocumentSchema,
  async (input, { user: actor, db }) => {
    await requireEmployeeName(db, input.employeeId);
    return createPendingUpload(db, {
      entityType: ENTITY,
      entityId: input.employeeId,
      filename: input.filename,
      mime: input.mime,
      size: input.size,
      uploadedBy: actor.id,
    });
  },
);

export const confirmEmployeeDocumentAction = actionNoTx(
  "employee.manage",
  confirmEmployeeDocumentSchema,
  async (input, { user: actor, db }) => {
    const name = await requireEmployeeName(db, input.employeeId);
    return confirmAttachment(db, {
      fileId: input.fileId,
      entityType: ENTITY,
      entityId: input.employeeId,
      kind: input.kind,
      actorId: actor.id,
      auditAction: "employee.document.added",
      auditSummary: `Added a ${input.kind} to ${name}`,
    });
  },
);

export const getEmployeeDocumentUrlAction = actionNoTx(
  "employee.view",
  employeeDocumentIdSchema,
  async (input, { db }) =>
    getAttachmentDownloadUrl(db, {
      attachmentId: input.attachmentId,
      entityType: ENTITY,
      entityId: input.employeeId,
    }),
);

export const deleteEmployeeDocumentAction = actionNoTx(
  "employee.manage",
  employeeDocumentIdSchema,
  async (input, { user: actor, db }) => {
    const name = await requireEmployeeName(db, input.employeeId);
    await removeAttachment(db, {
      attachmentId: input.attachmentId,
      entityType: ENTITY,
      entityId: input.employeeId,
      actorId: actor.id,
      auditAction: "employee.document.removed",
      auditSummary: `Removed a document from ${name}`,
    });
    return { ok: true };
  },
);

// ── Notes ──────────────────────────────────────────────────────────────────────
export const addEmployeeNoteAction = actionNoTx(
  "employee.manage",
  addEmployeeNoteSchema,
  async (input, { user: actor, db }) => {
    const name = await requireEmployeeName(db, input.employeeId);
    return addNote(db, {
      entityType: ENTITY,
      entityId: input.employeeId,
      body: input.body,
      actorId: actor.id,
      auditAction: "employee.note.added",
      auditSummary: `Added a note to ${name}`,
    });
  },
);

export const deleteEmployeeNoteAction = actionNoTx(
  "employee.manage",
  employeeNoteIdSchema,
  async (input, { user: actor, db }) => {
    const name = await requireEmployeeName(db, input.employeeId);
    await removeNote(db, {
      noteId: input.noteId,
      entityType: ENTITY,
      entityId: input.employeeId,
      actorId: actor.id,
      auditAction: "employee.note.removed",
      auditSummary: `Removed a note from ${name}`,
    });
    return { ok: true };
  },
);

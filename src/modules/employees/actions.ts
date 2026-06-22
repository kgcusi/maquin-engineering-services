"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";

import type { Database } from "@/db/client";
import { employees } from "@/db/schema/employees";
import { orNull, requireEntityRef } from "@/lib/action-helpers";
import { audit, diffFields } from "@/lib/audit";
import { Money } from "@/lib/money";
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
  addEmployeeNoteSchema,
  confirmEmployeeDocumentSchema,
  createEmployeeSchema,
  type CreateEmployeeInput,
  employeeDocumentIdSchema,
  employeeIdSchema,
  employeeNoteIdSchema,
  presignEmployeeDocumentSchema,
  updateEmployeeSchema,
} from "./schema";

const ENTITY = "employee";
const toRate = (v?: string) => (v && v.length ? Money.fromDecimal(v) : null);

const requireEmployeeName = (db: Database, id: string) =>
  requireEntityRef(db, {
    label: "Employee",
    table: employees,
    idColumn: employees.id,
    nameColumn: employees.fullName,
    id,
  });

// Shared create → row mapping (single create + bulk import stay in lockstep);
// `rate` becomes a Money VO, optional text columns become null.
const toEmployeeValues = (input: CreateEmployeeInput) => ({
  fullName: input.fullName,
  position: orNull(input.position),
  employmentType: orNull(input.employmentType),
  dateHired: orNull(input.dateHired),
  phone: orNull(input.phone),
  email: orNull(input.email),
  address: orNull(input.address),
  rate: toRate(input.rate),
  rateUnit: input.rateUnit,
  isActive: input.isActive,
  notes: orNull(input.notes),
});

export const createEmployeeAction = action(
  "employee.manage",
  createEmployeeSchema,
  async (input, { user: actor, tx }) => {
    const [created] = await tx.insert(employees).values(toEmployeeValues(input)).returning({
      id: employees.id,
    });

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

// Bulk create from a validated CSV/XLSX import — re-validated server-side, one
// statement in the action's transaction, one audit summary entry.
export const bulkCreateEmployeesAction = action(
  "employee.manage",
  z.array(createEmployeeSchema).min(1).max(IMPORT_ROW_LIMIT),
  async (rows, { user: actor, tx }) => {
    await tx.insert(employees).values(rows.map(toEmployeeValues));
    await audit(tx, {
      actorId: actor.id,
      action: "employee.imported",
      entityType: ENTITY,
      summary: `Imported ${rows.length} employee${rows.length === 1 ? "" : "s"}`,
      diff: { count: rows.length },
    });
    return { count: rows.length };
  },
);

export const updateEmployeeAction = action(
  "employee.manage",
  updateEmployeeSchema,
  async (input, { user: actor, tx }) => {
    const [target] = await tx
      .select({
        fullName: employees.fullName,
        position: employees.position,
        employmentType: employees.employmentType,
        dateHired: employees.dateHired,
        phone: employees.phone,
        email: employees.email,
        address: employees.address,
        rate: employees.rate,
        rateUnit: employees.rateUnit,
        isActive: employees.isActive,
        notes: employees.notes,
      })
      .from(employees)
      .where(eq(employees.id, input.id))
      .limit(1);
    if (!target) throw new ActionError("Employee not found.");

    const nextRate = toRate(input.rate);
    const next = {
      fullName: input.fullName,
      position: orNull(input.position),
      employmentType: orNull(input.employmentType),
      dateHired: orNull(input.dateHired),
      phone: orNull(input.phone),
      email: orNull(input.email),
      address: orNull(input.address),
      rate: nextRate,
      rateUnit: input.rateUnit,
      isActive: input.isActive,
      notes: orNull(input.notes),
    };

    await tx
      .update(employees)
      .set({ ...next, updatedAt: new Date() })
      .where(eq(employees.id, input.id));

    // `rate` is a Money VO — compare and record it as its decimal string so the
    // diff stays readable (and Money objects don't false-trigger on identity).
    const moneyStr = (m: Money | null) => m?.toDecimalString() ?? null;
    await audit(tx, {
      actorId: actor.id,
      action: "employee.updated",
      entityType: ENTITY,
      entityId: input.id,
      summary: `Updated employee ${input.fullName}`,
      diff: diffFields(
        { ...target, rate: moneyStr(target.rate) },
        { ...next, rate: moneyStr(nextRate) },
      ),
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

// Active/inactive toggle — distinct from delete: an inactive employee stays in the
// directory but is excluded from selection in other modules (DSR manpower, etc.).
// Idempotent (a no-op returns without writing an audit row).
export const deactivateEmployeeAction = action(
  "employee.manage",
  employeeIdSchema,
  async (input, { user: actor, tx }) => {
    const [target] = await tx
      .select({ id: employees.id, fullName: employees.fullName, isActive: employees.isActive })
      .from(employees)
      .where(eq(employees.id, input.id))
      .limit(1);
    if (!target) throw new ActionError("Employee not found.");
    if (!target.isActive) return { id: input.id };

    await tx
      .update(employees)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(employees.id, input.id));
    await audit(tx, {
      actorId: actor.id,
      action: "employee.deactivated",
      entityType: ENTITY,
      entityId: input.id,
      summary: `Deactivated employee ${target.fullName}`,
    });

    return { id: input.id };
  },
);

export const activateEmployeeAction = action(
  "employee.manage",
  employeeIdSchema,
  async (input, { user: actor, tx }) => {
    const [target] = await tx
      .select({ id: employees.id, fullName: employees.fullName, isActive: employees.isActive })
      .from(employees)
      .where(eq(employees.id, input.id))
      .limit(1);
    if (!target) throw new ActionError("Employee not found.");
    if (target.isActive) return { id: input.id };

    await tx
      .update(employees)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(employees.id, input.id));
    await audit(tx, {
      actorId: actor.id,
      action: "employee.reactivated",
      entityType: ENTITY,
      entityId: input.id,
      summary: `Reactivated employee ${target.fullName}`,
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
      label: input.name,
      actorId: actor.id,
      auditAction: "employee.document.added",
      auditSummary: `Added a document to ${name}`,
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

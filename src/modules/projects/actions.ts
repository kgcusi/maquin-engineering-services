"use server";

import { and, eq, inArray } from "drizzle-orm";

import type { Database } from "@/db/client";
import { projectMembers } from "@/db/schema/project-members";
import { projects } from "@/db/schema/projects";
import { orNull, requireEntityRef } from "@/lib/action-helpers";
import { audit, diffFields } from "@/lib/audit";
import { emitEvent } from "@/lib/events";
import { Money } from "@/lib/money";
import { ActionError, action, actionNoTx, assertProjectAccess } from "@/lib/rbac";
import { projectStatusLabel, type ProjectStatus } from "@/lib/statuses";
import {
  confirmAttachment,
  createPendingUpload,
  getAttachmentDownloadUrl,
  removeAttachment,
} from "@/modules/files/service";
import { addNote, removeNote } from "@/modules/notes/service";
import { nextRefCode } from "@/lib/refcodes";

import { canTransitionProject, normalizeTeam } from "./domain";
import {
  addProjectNoteSchema,
  changeProjectStatusSchema,
  confirmProjectDocumentSchema,
  createProjectSchema,
  type CreateProjectInput,
  presignProjectDocumentSchema,
  projectDocumentIdSchema,
  projectIdSchema,
  projectNoteIdSchema,
  updateProjectSchema,
} from "./schema";

const ENTITY = "project";

const toMoney = (v?: string) => (v && v.length ? Money.fromDecimal(v) : null);
const moneyStr = (m: Money | null) => m?.toDecimalString() ?? null;
const roleOf = (u: { role?: string | null }) => u.role ?? null;

const requireProjectName = (db: Database, id: string) =>
  requireEntityRef(db, {
    label: "Project",
    table: projects,
    idColumn: projects.id,
    nameColumn: projects.name,
    id,
  });

// Project columns shared by create/update ("" → null on optionals; Money VO).
const toProjectColumns = (input: CreateProjectInput, leadId: string | null) => ({
  name: input.name,
  clientId: input.clientId,
  location: orNull(input.location),
  contractAmount: toMoney(input.contractAmount),
  startDate: orNull(input.startDate),
  targetEndDate: orNull(input.targetEndDate),
  scopeOfWork: orNull(input.scopeOfWork),
  defectsLiabilityUntil: orNull(input.defectsLiabilityUntil),
  leadEngineerId: leadId,
});

// LEAD + MEMBER project_members rows for a team. INSPECTOR rows (inspection grants)
// are managed separately and never touched here.
const teamRows = (projectId: string, leadId: string | null, memberIds: string[]) => [
  ...(leadId ? [{ projectId, userId: leadId, roleOnProject: "LEAD" }] : []),
  ...memberIds.map((userId) => ({ projectId, userId, roleOnProject: "MEMBER" })),
];

// ── Core CRUD ───────────────────────────────────────────────────────────────
export const createProjectAction = action(
  "project.create",
  createProjectSchema,
  async (input, { user: actor, tx }) => {
    const { leadId, memberIds } = normalizeTeam(input.leadEngineerId, input.memberIds);
    const refCode = await nextRefCode(tx, "PRJ", new Date().getFullYear());

    const [created] = await tx
      .insert(projects)
      .values({ ...toProjectColumns(input, leadId), refCode, createdBy: actor.id })
      .returning({ id: projects.id });

    const rows = teamRows(created.id, leadId, memberIds);
    if (rows.length) await tx.insert(projectMembers).values(rows);

    await audit(tx, {
      actorId: actor.id,
      action: "project.created",
      entityType: ENTITY,
      entityId: created.id,
      summary: `Created project ${refCode} — ${input.name}`,
      diff: { name: input.name, refCode, memberCount: rows.length },
    });
    await emitEvent(tx, {
      type: "project.created",
      payload: {
        entityType: ENTITY,
        entityId: created.id,
        summary: `Project ${refCode} — ${input.name} was created.`,
        actorId: actor.id,
      },
    });

    return { id: created.id };
  },
);

export const updateProjectAction = action(
  "project.update",
  updateProjectSchema,
  async (input, { user: actor, tx }) => {
    const [target] = await tx
      .select({
        name: projects.name,
        clientId: projects.clientId,
        location: projects.location,
        contractAmount: projects.contractAmount,
        startDate: projects.startDate,
        targetEndDate: projects.targetEndDate,
        scopeOfWork: projects.scopeOfWork,
        defectsLiabilityUntil: projects.defectsLiabilityUntil,
        leadEngineerId: projects.leadEngineerId,
      })
      .from(projects)
      .where(eq(projects.id, input.id))
      .limit(1);
    if (!target) throw new ActionError("Project not found.");

    const { leadId, memberIds } = normalizeTeam(input.leadEngineerId, input.memberIds);
    const next = toProjectColumns(input, leadId);

    await tx
      .update(projects)
      .set({ ...next, updatedAt: new Date() })
      .where(eq(projects.id, input.id));

    // Reconcile the team: replace LEAD/MEMBER rows, leave INSPECTOR grants intact.
    await tx
      .delete(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, input.id),
          inArray(projectMembers.roleOnProject, ["LEAD", "MEMBER"]),
        ),
      );
    const rows = teamRows(input.id, leadId, memberIds);
    if (rows.length) await tx.insert(projectMembers).values(rows);

    await audit(tx, {
      actorId: actor.id,
      action: "project.updated",
      entityType: ENTITY,
      entityId: input.id,
      summary: `Updated project ${input.name}`,
      diff: diffFields(
        { ...target, contractAmount: moneyStr(target.contractAmount) },
        { ...next, contractAmount: moneyStr(next.contractAmount) },
      ),
    });

    return { id: input.id };
  },
);

// Soft delete — keeps the row so phases/tasks/DSRs and history keep resolving.
export const deleteProjectAction = action(
  "project.delete",
  projectIdSchema,
  async (input, { user: actor, tx }) => {
    const [target] = await tx
      .select({ id: projects.id, name: projects.name, deletedAt: projects.deletedAt })
      .from(projects)
      .where(eq(projects.id, input.id))
      .limit(1);
    if (!target) throw new ActionError("Project not found.");
    if (target.deletedAt) return { id: input.id };

    await tx.update(projects).set({ deletedAt: new Date() }).where(eq(projects.id, input.id));
    await audit(tx, {
      actorId: actor.id,
      action: "project.deleted",
      entityType: ENTITY,
      entityId: input.id,
      summary: `Deleted project ${target.name}`,
    });

    return { id: input.id };
  },
);

// Validated lifecycle transition (docs/17 §9-Group A). Completion stamps the
// actual end date — a human sign-off, never derived.
export const changeProjectStatusAction = action(
  "project.update",
  changeProjectStatusSchema,
  async (input, { user: actor, tx }) => {
    const [target] = await tx
      .select({ name: projects.name, status: projects.status })
      .from(projects)
      .where(eq(projects.id, input.id))
      .limit(1);
    if (!target) throw new ActionError("Project not found.");

    const from = target.status as ProjectStatus;
    const to = input.status;
    if (from === to) return { id: input.id };
    if (!canTransitionProject(from, to)) {
      throw new ActionError(
        `Can't move a project from ${projectStatusLabel(from)} to ${projectStatusLabel(to)}.`,
      );
    }

    const actualEndDate =
      to === "COMPLETED"
        ? (orNull(input.actualEndDate) ?? new Date().toISOString().slice(0, 10))
        : null;

    await tx
      .update(projects)
      .set({ status: to, actualEndDate, updatedAt: new Date() })
      .where(eq(projects.id, input.id));

    await audit(tx, {
      actorId: actor.id,
      action: "project.status_changed",
      entityType: ENTITY,
      entityId: input.id,
      summary: `${target.name}: ${projectStatusLabel(from)} → ${projectStatusLabel(to)}`,
      diff: { status: { from, to } },
    });
    await emitEvent(tx, {
      type: "project.status_changed",
      payload: {
        entityType: ENTITY,
        entityId: input.id,
        summary: `${target.name} moved from ${projectStatusLabel(from)} to ${projectStatusLabel(to)}.`,
        actorId: actor.id,
      },
    });

    return { id: input.id };
  },
);

// ── Documents (admin-managed) + Notes (team-collaborative), scoped to the project ─
export const presignProjectDocumentAction = actionNoTx(
  "project.update",
  presignProjectDocumentSchema,
  async (input, { user: actor, db }) => {
    await requireProjectName(db, input.projectId);
    await assertProjectAccess(db, {
      userId: actor.id,
      role: roleOf(actor),
      projectId: input.projectId,
    });
    return createPendingUpload(db, {
      entityType: ENTITY,
      entityId: input.projectId,
      filename: input.filename,
      mime: input.mime,
      size: input.size,
      uploadedBy: actor.id,
    });
  },
);

export const confirmProjectDocumentAction = actionNoTx(
  "project.update",
  confirmProjectDocumentSchema,
  async (input, { user: actor, db }) => {
    const name = await requireProjectName(db, input.projectId);
    await assertProjectAccess(db, {
      userId: actor.id,
      role: roleOf(actor),
      projectId: input.projectId,
    });
    return confirmAttachment(db, {
      fileId: input.fileId,
      entityType: ENTITY,
      entityId: input.projectId,
      label: input.name,
      actorId: actor.id,
      auditAction: "project.document.added",
      auditSummary: `Added a document to ${name}`,
    });
  },
);

export const getProjectDocumentUrlAction = actionNoTx(
  "project.view.assigned",
  projectDocumentIdSchema,
  async (input, { user: actor, db }) => {
    await assertProjectAccess(db, {
      userId: actor.id,
      role: roleOf(actor),
      projectId: input.projectId,
    });
    return getAttachmentDownloadUrl(db, {
      attachmentId: input.attachmentId,
      entityType: ENTITY,
      entityId: input.projectId,
    });
  },
);

export const deleteProjectDocumentAction = actionNoTx(
  "project.update",
  projectDocumentIdSchema,
  async (input, { user: actor, db }) => {
    const name = await requireProjectName(db, input.projectId);
    await assertProjectAccess(db, {
      userId: actor.id,
      role: roleOf(actor),
      projectId: input.projectId,
    });
    await removeAttachment(db, {
      attachmentId: input.attachmentId,
      entityType: ENTITY,
      entityId: input.projectId,
      actorId: actor.id,
      auditAction: "project.document.removed",
      auditSummary: `Removed a document from ${name}`,
    });
    return { ok: true };
  },
);

export const addProjectNoteAction = actionNoTx(
  "project.view.assigned",
  addProjectNoteSchema,
  async (input, { user: actor, db }) => {
    const name = await requireProjectName(db, input.projectId);
    await assertProjectAccess(db, {
      userId: actor.id,
      role: roleOf(actor),
      projectId: input.projectId,
    });
    return addNote(db, {
      entityType: ENTITY,
      entityId: input.projectId,
      body: input.body,
      actorId: actor.id,
      auditAction: "project.note.added",
      auditSummary: `Added a note to ${name}`,
    });
  },
);

export const deleteProjectNoteAction = actionNoTx(
  "project.view.assigned",
  projectNoteIdSchema,
  async (input, { user: actor, db }) => {
    const name = await requireProjectName(db, input.projectId);
    await assertProjectAccess(db, {
      userId: actor.id,
      role: roleOf(actor),
      projectId: input.projectId,
    });
    await removeNote(db, {
      noteId: input.noteId,
      entityType: ENTITY,
      entityId: input.projectId,
      actorId: actor.id,
      auditAction: "project.note.removed",
      auditSummary: `Removed a note from ${name}`,
    });
    return { ok: true };
  },
);

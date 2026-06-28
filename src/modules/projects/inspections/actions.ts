"use server";

import { and, eq, isNull, max } from "drizzle-orm";
import { z } from "zod";

import type { Database } from "@/db/client";
import { attachments } from "@/db/schema/attachments";
import { user } from "@/db/schema/auth";
import { files } from "@/db/schema/files";
import { inspectionAttempts, inspectionItemResults } from "@/db/schema/inspection-attempts";
import { inspections } from "@/db/schema/inspections";
import { projectMembers } from "@/db/schema/project-members";
import { orNull } from "@/lib/action-helpers";
import { audit } from "@/lib/audit";
import { emitEvent } from "@/lib/events";
import { nextRefCode } from "@/lib/refcodes";
import { ActionError, action, actionNoTx, assertProjectAccess, hasPermission } from "@/lib/rbac";
import { ROLES } from "@/lib/roles";
import { objectExists } from "@/lib/storage";
import { inspectionStatusLabel } from "@/lib/statuses";
import { createPendingUpload, getAttachmentDownloadUrl } from "@/modules/files/service";

import { getActiveChecklistsWithItems } from "./checklists/queries";
import {
  INSPECTION_ENTITY,
  INSPECTION_ITEM_PHOTO_ENTITY,
  INSPECTION_ITEM_RESULT_ENTITY,
} from "./domain";
import { getInspectionAttempts, getInspectionRecordingDefaults } from "./queries";
import {
  inspectionIdSchema,
  inspectionPhotoUrlSchema,
  inspectionRefSchema,
  presignInspectionPhotoSchema,
  recordInspectionSchema,
  requestInspectionSchema,
} from "./schema";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Exec = Database | Tx;
const roleOf = (u: { role?: string | null }) => u.role ?? null;

// The named inspector must be an active QA/QC engineer — the action is the trust
// boundary, not the picker (mirrors assertAssigneeIsMember in the tasks module).
async function assertInspectorIsQaQc(tx: Tx, inspectorId: string): Promise<void> {
  const [row] = await tx
    .select({ role: user.role, deletedAt: user.deletedAt })
    .from(user)
    .where(eq(user.id, inspectorId))
    .limit(1);
  if (!row || row.deletedAt || row.role !== ROLES.QA_QC_ENGINEER) {
    throw new ActionError("Pick a QA/QC engineer to inspect.");
  }
}

type InspectionCore = {
  projectId: string;
  status: string;
  refCode: string;
  title: string;
  inspectorId: string | null;
  requestedById: string | null;
};

async function loadInspection(exec: Exec, id: string): Promise<InspectionCore | null> {
  const [row] = await exec
    .select({
      projectId: inspections.projectId,
      status: inspections.status,
      refCode: inspections.refCode,
      title: inspections.title,
      inspectorId: inspections.inspectorId,
      requestedById: inspections.requestedById,
    })
    .from(inspections)
    .where(and(eq(inspections.id, id), isNull(inspections.deletedAt)))
    .limit(1);
  return row ?? null;
}

// Engineer raises a request naming a QA/QC engineer. The same tx grants the
// inspector INSPECTOR membership (so they can open the project) and emits the
// notification — both succeed or neither does.
export const requestInspectionAction = action(
  "inspection.request",
  requestInspectionSchema,
  async (input, { user: actor, tx }) => {
    await assertProjectAccess(tx, {
      userId: actor.id,
      role: roleOf(actor),
      projectId: input.projectId,
    });
    await assertInspectorIsQaQc(tx, input.inspectorId);

    const refCode = await nextRefCode(tx, "INS", new Date().getFullYear());
    const [created] = await tx
      .insert(inspections)
      .values({
        refCode,
        projectId: input.projectId,
        title: input.title,
        area: orNull(input.area),
        description: orNull(input.description),
        scheduledFor: orNull(input.scheduledFor),
        inspectorId: input.inspectorId,
        requestedById: actor.id,
      })
      .returning({ id: inspections.id });

    // Grant project visibility. onConflictDoNothing on the unique (project,user)
    // preserves an existing LEAD/MEMBER row — INSPECTOR is only added when the user
    // has no membership yet, so a request never downgrades a teammate.
    await tx
      .insert(projectMembers)
      .values({
        projectId: input.projectId,
        userId: input.inspectorId,
        roleOnProject: "INSPECTOR",
      })
      .onConflictDoNothing({ target: [projectMembers.projectId, projectMembers.userId] });

    await audit(tx, {
      actorId: actor.id,
      action: "inspection.requested",
      entityType: INSPECTION_ENTITY,
      entityId: created.id,
      summary: `Requested inspection ${refCode}: ${input.title}`,
    });
    await emitEvent(tx, {
      type: "inspection.requested",
      payload: {
        entityType: INSPECTION_ENTITY,
        entityId: created.id,
        projectId: input.projectId,
        inspectorId: input.inspectorId,
        actorId: actor.id,
        summary: `You were asked to inspect "${input.title}".`,
      },
    });

    return { id: created.id };
  },
);

// QA/QC records an outcome — the FIRST inspection OR a re-inspection. Both append
// an `inspection_attempts` row (with snapshotted item results + re-homed photos) and
// update the inspection's LATEST status; the record itself is never replaced
// (docs/17 §10.16). Only the named inspector (or an admin) may record.
//
// actionNoTx: the per-photo R2 HEAD checks run BEFORE the transaction (mirrors
// confirmAttachment) so a network call never holds a pooled txn-mode connection.
export const recordInspectionOutcomeAction = actionNoTx(
  "inspection.record",
  recordInspectionSchema,
  async (input, { user: actor, db }) => {
    const current = await loadInspection(db, input.id);
    if (!current) throw new ActionError("Inspection not found.");
    await assertProjectAccess(db, {
      userId: actor.id,
      role: roleOf(actor),
      projectId: current.projectId,
    });
    if (current.inspectorId !== actor.id && !hasPermission(roleOf(actor), "project.view.all")) {
      throw new ActionError("Only the assigned QA/QC engineer can record this outcome.");
    }

    // Validate every item photo up front: it must be an upload anchored to THIS
    // inspection (confused-deputy guard) and actually present in storage.
    for (const item of input.items) {
      for (const fileId of item.fileIds) {
        const [file] = await db
          .select({ key: files.key })
          .from(files)
          .where(eq(files.id, fileId))
          .limit(1);
        if (!file || !file.key.startsWith(`${INSPECTION_ITEM_PHOTO_ENTITY}/${input.id}/`)) {
          throw new ActionError("A photo doesn't belong to this inspection.");
        }
        if (!(await objectExists(file.key))) {
          throw new ActionError("A photo upload is missing — please re-add it.");
        }
      }
    }

    const outcomeLabel = inspectionStatusLabel(input.outcome).toLowerCase();
    const checklistId = orNull(input.checklistId);

    const attemptNo = await db.transaction(async (tx) => {
      const [{ maxNo }] = await tx
        .select({ maxNo: max(inspectionAttempts.attemptNo) })
        .from(inspectionAttempts)
        .where(eq(inspectionAttempts.inspectionId, input.id));
      const nextNo = (maxNo ?? 0) + 1;

      const [attempt] = await tx
        .insert(inspectionAttempts)
        .values({
          inspectionId: input.id,
          attemptNo: nextNo,
          outcome: input.outcome,
          remarks: orNull(input.remarks),
          recordedById: actor.id,
        })
        .returning({ id: inspectionAttempts.id });

      for (let i = 0; i < input.items.length; i++) {
        const item = input.items[i];
        const [result] = await tx
          .insert(inspectionItemResults)
          .values({
            attemptId: attempt.id,
            label: item.label,
            result: item.result,
            remarks: orNull(item.remarks),
            sequence: i,
          })
          .returning({ id: inspectionItemResults.id });
        // Re-home each pre-uploaded photo onto this result row.
        for (const fileId of item.fileIds) {
          await tx.update(files).set({ status: "CONFIRMED" }).where(eq(files.id, fileId));
          await tx.insert(attachments).values({
            entityType: INSPECTION_ITEM_RESULT_ENTITY,
            entityId: result.id,
            fileId,
            createdBy: actor.id,
          });
        }
      }

      await tx
        .update(inspections)
        .set({
          status: input.outcome,
          outcomeRemarks: orNull(input.remarks),
          checklistId,
          inspectedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(inspections.id, input.id));

      await audit(tx, {
        actorId: actor.id,
        action: "inspection.recorded",
        entityType: INSPECTION_ENTITY,
        entityId: input.id,
        summary: `${current.refCode}: ${outcomeLabel} (attempt ${nextNo})`,
      });
      await emitEvent(tx, {
        type: "inspection.completed",
        payload: {
          entityType: INSPECTION_ENTITY,
          entityId: input.id,
          projectId: current.projectId,
          requestedById: current.requestedById,
          actorId: actor.id,
          summary: `Inspection "${current.title}" was ${outcomeLabel}.`,
        },
      });

      return nextNo;
    });

    return { id: input.id, attemptNo };
  },
);

// Upload-on-pick of an inspection photo (before its item-result row exists). The
// key is anchored to the inspection; recordInspectionOutcomeAction re-homes the
// attachment onto the chosen item result.
export const presignInspectionPhotoAction = actionNoTx(
  "inspection.record",
  presignInspectionPhotoSchema,
  async (input, { user: actor, db }) => {
    const current = await loadInspection(db, input.inspectionId);
    if (!current) throw new ActionError("Inspection not found.");
    await assertProjectAccess(db, {
      userId: actor.id,
      role: roleOf(actor),
      projectId: current.projectId,
    });
    if (current.inspectorId !== actor.id && !hasPermission(roleOf(actor), "project.view.all")) {
      throw new ActionError("Only the assigned QA/QC engineer can add inspection photos.");
    }
    return createPendingUpload(db, {
      entityType: INSPECTION_ITEM_PHOTO_ENTITY,
      entityId: input.inspectionId,
      filename: input.filename,
      mime: input.mime,
      size: input.size,
      uploadedBy: actor.id,
    });
  },
);

// Short-lived presigned GET for a recorded item-result photo, scoped to the
// inspection (any project member who can view inspections may open it).
export const getInspectionPhotoUrlAction = actionNoTx(
  "inspection.view",
  inspectionPhotoUrlSchema,
  async (input, { user: actor, db }) => {
    const current = await loadInspection(db, input.inspectionId);
    if (!current) throw new ActionError("Inspection not found.");
    await assertProjectAccess(db, {
      userId: actor.id,
      role: roleOf(actor),
      projectId: current.projectId,
    });
    return getAttachmentDownloadUrl(db, {
      attachmentId: input.attachmentId,
      entityType: INSPECTION_ITEM_RESULT_ENTITY,
      entityId: input.resultId,
    });
  },
);

// ── Read actions for the recording UI (the client dialog lazy-loads these) ─────

// Active preset checklists for the inspection-time picker. Guarded by
// inspection.record (only the inspector picks one).
export const listActiveChecklistsAction = actionNoTx("inspection.record", z.object({}), async () =>
  getActiveChecklistsWithItems(),
);

// Re-inspection pre-fill: the checklistId + the last attempt's item results.
export const getInspectionRecordingDefaultsAction = actionNoTx(
  "inspection.record",
  inspectionRefSchema,
  async (input, { user: actor, db }) => {
    const current = await loadInspection(db, input.inspectionId);
    if (!current) throw new ActionError("Inspection not found.");
    await assertProjectAccess(db, {
      userId: actor.id,
      role: roleOf(actor),
      projectId: current.projectId,
    });
    return getInspectionRecordingDefaults(input.inspectionId);
  },
);

// The attempt history timeline (lazy-loaded when a viewer expands an inspection).
export const getInspectionAttemptsAction = actionNoTx(
  "inspection.view",
  inspectionRefSchema,
  async (input, { user: actor, db }) => {
    const current = await loadInspection(db, input.inspectionId);
    if (!current) throw new ActionError("Inspection not found.");
    await assertProjectAccess(db, {
      userId: actor.id,
      role: roleOf(actor),
      projectId: current.projectId,
    });
    return getInspectionAttempts(input.inspectionId);
  },
);

// The requester (or an admin) may withdraw a request that hasn't been acted on.
export const deleteInspectionAction = action(
  "inspection.request",
  inspectionIdSchema,
  async (input, { user: actor, tx }) => {
    const current = await loadInspection(tx, input.id);
    if (!current) throw new ActionError("Inspection not found.");
    await assertProjectAccess(tx, {
      userId: actor.id,
      role: roleOf(actor),
      projectId: current.projectId,
    });
    if (current.requestedById !== actor.id && !hasPermission(roleOf(actor), "project.view.all")) {
      throw new ActionError("Only the requester can withdraw this inspection.");
    }
    if (current.status !== "REQUESTED") {
      throw new ActionError("This inspection already has an outcome.");
    }

    await tx.update(inspections).set({ deletedAt: new Date() }).where(eq(inspections.id, input.id));
    await audit(tx, {
      actorId: actor.id,
      action: "inspection.deleted",
      entityType: INSPECTION_ENTITY,
      entityId: input.id,
      summary: `Withdrew inspection ${current.refCode}`,
    });
    return { id: input.id };
  },
);

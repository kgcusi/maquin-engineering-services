import { and, asc, count, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db/client";
import { user } from "@/db/schema/auth";
import { attachments } from "@/db/schema/attachments";
import { files } from "@/db/schema/files";
import { inspectionAttempts, inspectionItemResults } from "@/db/schema/inspection-attempts";
import { inspections } from "@/db/schema/inspections";
import { INSPECTION_ITEM_RESULT_ENTITY } from "./domain";
import { visibleUserWhere } from "@/lib/rbac";
import { ROLES } from "@/lib/roles";
import {
  offsetFor,
  PAGE_SIZE,
  type DirectoryListParams,
  type Paginated,
} from "@/modules/shared/list-params";

import type { Option } from "../queries";

const ACTIVE_USER = or(isNull(user.isActive), eq(user.isActive, true));

// Two `user` joins (inspector + requester) need distinct aliases.
const inspectorUser = alias(user, "inspector_user");
const requesterUser = alias(user, "requester_user");

export type InspectionListRow = {
  id: string;
  refCode: string;
  title: string;
  area: string | null;
  description: string | null;
  status: string;
  scheduledFor: string | null;
  inspectorId: string | null;
  inspectorName: string | null;
  requestedById: string | null;
  requestedByName: string | null;
  outcomeRemarks: string | null;
  requestedAt: Date;
  inspectedAt: Date | null;
};

export async function listProjectInspections(
  projectId: string,
  params: DirectoryListParams,
): Promise<Paginated<InspectionListRow>> {
  const where = and(eq(inspections.projectId, projectId), isNull(inspections.deletedAt));

  const [rows, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: inspections.id,
        refCode: inspections.refCode,
        title: inspections.title,
        area: inspections.area,
        description: inspections.description,
        status: inspections.status,
        scheduledFor: inspections.scheduledFor,
        inspectorId: inspections.inspectorId,
        inspectorName: inspectorUser.name,
        requestedById: inspections.requestedById,
        requestedByName: requesterUser.name,
        outcomeRemarks: inspections.outcomeRemarks,
        requestedAt: inspections.requestedAt,
        inspectedAt: inspections.inspectedAt,
      })
      .from(inspections)
      .leftJoin(inspectorUser, eq(inspections.inspectorId, inspectorUser.id))
      .leftJoin(requesterUser, eq(inspections.requestedById, requesterUser.id))
      .where(where)
      .orderBy(desc(inspections.requestedAt))
      .limit(PAGE_SIZE)
      .offset(offsetFor(params.page, PAGE_SIZE)),
    db.select({ value: count() }).from(inspections).where(where),
  ]);

  return { rows, total, page: params.page, pageSize: PAGE_SIZE };
}

export type InspectionStatusCounts = {
  requested: number;
  passed: number;
  failed: number;
  total: number;
};

/** Per-status inspection tallies for the project overview. Scoped to the project
 *  (caller already gated access); excludes soft-deleted inspections. */
export async function getProjectInspectionStatusCounts(
  projectId: string,
): Promise<InspectionStatusCounts> {
  const rows = await db
    .select({ status: inspections.status, value: count() })
    .from(inspections)
    .where(and(eq(inspections.projectId, projectId), isNull(inspections.deletedAt)))
    .groupBy(inspections.status);

  const counts: InspectionStatusCounts = { requested: 0, passed: 0, failed: 0, total: 0 };
  for (const row of rows) {
    counts.total += row.value;
    if (row.status === "REQUESTED") counts.requested = row.value;
    else if (row.status === "PASSED") counts.passed = row.value;
    else if (row.status === "FAILED") counts.failed = row.value;
  }
  return counts;
}

/** Active QA/QC engineers for the "request inspection" picker. Applies
 *  `visibleUserWhere()` (hides the webmaster / archived users) + active filter. */
export function listQaQcEngineerOptions(): Promise<Option[]> {
  return db
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(and(eq(user.role, ROLES.QA_QC_ENGINEER), visibleUserWhere(), ACTIVE_USER))
    .orderBy(asc(user.name));
}

export type InspectionItemPhoto = { attachmentId: string; filename: string };
export type InspectionItemResultView = {
  id: string;
  label: string;
  result: string;
  remarks: string | null;
  photos: InspectionItemPhoto[];
};
export type InspectionAttemptView = {
  id: string;
  attemptNo: number;
  outcome: string;
  remarks: string | null;
  recordedAt: Date;
  recordedByName: string | null;
  items: InspectionItemResultView[];
};

/**
 * Full attempt timeline for one inspection (newest first) — the history log. Each
 * attempt carries its snapshotted item results and the per-item photo references
 * (attachmentId + filename; the URL is fetched on demand via the photo action).
 */
export async function getInspectionAttempts(
  inspectionId: string,
): Promise<InspectionAttemptView[]> {
  const attempts = await db
    .select({
      id: inspectionAttempts.id,
      attemptNo: inspectionAttempts.attemptNo,
      outcome: inspectionAttempts.outcome,
      remarks: inspectionAttempts.remarks,
      recordedAt: inspectionAttempts.recordedAt,
      recordedByName: user.name,
    })
    .from(inspectionAttempts)
    .leftJoin(user, eq(inspectionAttempts.recordedById, user.id))
    .where(eq(inspectionAttempts.inspectionId, inspectionId))
    .orderBy(desc(inspectionAttempts.attemptNo));
  if (!attempts.length) return [];

  const attemptIds = attempts.map((a) => a.id);
  const items = await db
    .select({
      id: inspectionItemResults.id,
      attemptId: inspectionItemResults.attemptId,
      label: inspectionItemResults.label,
      result: inspectionItemResults.result,
      remarks: inspectionItemResults.remarks,
      sequence: inspectionItemResults.sequence,
    })
    .from(inspectionItemResults)
    .where(inArray(inspectionItemResults.attemptId, attemptIds))
    .orderBy(asc(inspectionItemResults.sequence));

  const resultIds = items.map((i) => i.id);
  const photoRows = resultIds.length
    ? await db
        .select({
          resultId: attachments.entityId,
          attachmentId: attachments.id,
          filename: files.filename,
        })
        .from(attachments)
        .innerJoin(files, eq(attachments.fileId, files.id))
        .where(
          and(
            eq(attachments.entityType, INSPECTION_ITEM_RESULT_ENTITY),
            inArray(attachments.entityId, resultIds),
            eq(files.status, "CONFIRMED"),
          ),
        )
    : [];

  const photosByResult = new Map<string, InspectionItemPhoto[]>();
  for (const p of photoRows) {
    const list = photosByResult.get(p.resultId) ?? [];
    list.push({ attachmentId: p.attachmentId, filename: p.filename });
    photosByResult.set(p.resultId, list);
  }
  const itemsByAttempt = new Map<string, InspectionItemResultView[]>();
  for (const it of items) {
    const list = itemsByAttempt.get(it.attemptId) ?? [];
    list.push({
      id: it.id,
      label: it.label,
      result: it.result,
      remarks: it.remarks,
      photos: photosByResult.get(it.id) ?? [],
    });
    itemsByAttempt.set(it.attemptId, list);
  }

  return attempts.map((a) => ({ ...a, items: itemsByAttempt.get(a.id) ?? [] }));
}

export type InspectionRecordingDefaults = {
  checklistId: string | null;
  items: { label: string; result: string; remarks: string | null }[];
};

/**
 * Pre-fill source for re-inspection: the inspection's `checklistId` + the LATEST
 * attempt's item results (passed items carry forward, editable). Photos are NOT
 * carried forward — the inspector re-shoots what they re-check. Returns null items
 * when the inspection has no prior attempt (first inspection).
 */
export async function getInspectionRecordingDefaults(
  inspectionId: string,
): Promise<InspectionRecordingDefaults> {
  const [insp] = await db
    .select({ checklistId: inspections.checklistId })
    .from(inspections)
    .where(eq(inspections.id, inspectionId))
    .limit(1);

  const [latest] = await db
    .select({ id: inspectionAttempts.id })
    .from(inspectionAttempts)
    .where(eq(inspectionAttempts.inspectionId, inspectionId))
    .orderBy(desc(inspectionAttempts.attemptNo))
    .limit(1);

  const items = latest
    ? await db
        .select({
          label: inspectionItemResults.label,
          result: inspectionItemResults.result,
          remarks: inspectionItemResults.remarks,
        })
        .from(inspectionItemResults)
        .where(eq(inspectionItemResults.attemptId, latest.id))
        .orderBy(asc(inspectionItemResults.sequence))
    : [];

  return { checklistId: insp?.checklistId ?? null, items };
}

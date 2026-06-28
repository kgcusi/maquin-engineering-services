"use server";

import { and, desc, eq, inArray, isNull } from "drizzle-orm";

import type { Database } from "@/db/client";
import {
  dailyReports,
  dsrEquipment,
  dsrIssues,
  dsrManpower,
  dsrMaterials,
} from "@/db/schema/daily-reports";
import { orNull } from "@/lib/action-helpers";
import { audit } from "@/lib/audit";
import { todayInTimeZone } from "@/lib/datetime";
import { emitEvent } from "@/lib/events";
import { nextRefCode } from "@/lib/refcodes";
import { ActionError, action, actionNoTx, assertProjectAccess, hasPermission } from "@/lib/rbac";
import {
  confirmAttachment,
  createPendingUpload,
  getAttachmentDownloadUrl,
  removeAttachment,
} from "@/modules/files/service";
import { getSettings } from "@/modules/settings/queries";

import { canDeleteDsr, canReopenDsr, hasHighSeverityIssue } from "./domain";
import {
  confirmDsrPhotoSchema,
  dsrIdSchema,
  dsrPhotoIdSchema,
  presignDsrPhotoSchema,
  resolveTodayDsrSchema,
  reviewDsrSchema,
  saveDsrDraftSchema,
  type DsrEquipmentInput,
  type DsrManpowerInput,
  type DsrMaterialInput,
  type DsrIssueInput,
} from "./schema";

const ENTITY = "daily_report";
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

const roleOf = (u: { role?: string | null }) => u.role ?? null;
const numOrNull = (v: number | "" | undefined) => (v === "" || v === undefined ? null : v);

type DsrCore = {
  projectId: string;
  status: string;
  createdBy: string | null;
  refCode: string;
  workAccomplished: string | null;
};

async function loadDsr(tx: Tx, id: string): Promise<DsrCore | null> {
  const [row] = await tx
    .select({
      projectId: dailyReports.projectId,
      status: dailyReports.status,
      createdBy: dailyReports.createdBy,
      refCode: dailyReports.refCode,
      workAccomplished: dailyReports.workAccomplished,
    })
    .from(dailyReports)
    .where(and(eq(dailyReports.id, id), isNull(dailyReports.deletedAt)))
    .limit(1);
  return row ?? null;
}

// A DRAFT is editable by its author; an admin (dsr.view.all) may edit any.
function assertCanEdit(actor: { id: string; role?: string | null }, dsr: DsrCore): void {
  if (dsr.createdBy !== actor.id && !hasPermission(roleOf(actor), "dsr.view.all")) {
    throw new ActionError("Only the author can edit this report.");
  }
}

const manpowerValues = (dsrId: string, list: DsrManpowerInput[]) =>
  list.map((m) => ({
    dailyReportId: dsrId,
    employeeId: orNull(m.employeeId),
    tradeCode: orNull(m.tradeCode),
    headcount: m.headcount,
    hours: numOrNull(m.hours),
  }));
const equipmentValues = (dsrId: string, list: DsrEquipmentInput[]) =>
  list.map((e) => ({
    dailyReportId: dsrId,
    name: e.name,
    quantity: e.quantity,
    hours: numOrNull(e.hours),
    remarks: orNull(e.remarks),
  }));
const materialValues = (dsrId: string, list: DsrMaterialInput[]) =>
  list.map((m) => ({
    dailyReportId: dsrId,
    itemId: orNull(m.itemId),
    description: orNull(m.description),
    quantity: m.quantity,
    unitCode: orNull(m.unitCode),
  }));
const issueValues = (dsrId: string, list: DsrIssueInput[]) =>
  list.map((i) => ({
    dailyReportId: dsrId,
    description: i.description,
    severity: i.severity,
    resolved: i.resolved,
  }));

// ── Collision-safe "New DSR": resolve today's row up-front, create with
// carry-forward if absent. The caller routes to edit/resume/read-only — never
// fill-then-fail (docs/17 §10.5). ────────────────────────────────────────────
export const resolveTodayDsrAction = action(
  "dsr.create",
  resolveTodayDsrSchema,
  async (input, { user: actor, tx }) => {
    await assertProjectAccess(tx, {
      userId: actor.id,
      role: roleOf(actor),
      projectId: input.projectId,
    });

    // "Today" in the FIRM's timezone (not UTC) so the one-DSR-per-day key matches
    // the firm's calendar day, not the server's.
    const today = todayInTimeZone((await getSettings()).timezone);
    const reportFilter = and(
      eq(dailyReports.projectId, input.projectId),
      eq(dailyReports.reportDate, today),
      isNull(dailyReports.deletedAt),
    );

    const [existing] = await tx
      .select({ id: dailyReports.id, status: dailyReports.status })
      .from(dailyReports)
      .where(reportFilter)
      .limit(1);
    if (existing) return { id: existing.id, status: existing.status, created: false };

    const refCode = await nextRefCode(tx, "DSR", new Date().getFullYear());
    // Collision-tolerant insert: if two "Start today's report" requests race past the
    // existence check, the partial UNIQUE(project_id, report_date) WHERE deleted_at IS
    // NULL index makes the loser a no-op; we then resume the row the winner created
    // instead of surfacing a raw DB error (docs/17 §10.5 "never fill-then-fail"). The
    // `where` predicate must match the index predicate so the conflict is inferred.
    const insertedRows = await tx
      .insert(dailyReports)
      .values({
        refCode,
        projectId: input.projectId,
        reportDate: today,
        status: "DRAFT",
        createdBy: actor.id,
      })
      .onConflictDoNothing({
        target: [dailyReports.projectId, dailyReports.reportDate],
        where: isNull(dailyReports.deletedAt),
      })
      .returning({ id: dailyReports.id });

    if (insertedRows.length === 0) {
      const [raced] = await tx
        .select({ id: dailyReports.id, status: dailyReports.status })
        .from(dailyReports)
        .where(reportFilter)
        .limit(1);
      if (!raced) throw new ActionError("Couldn't open today's report. Please try again.");
      return { id: raced.id, status: raced.status, created: false };
    }
    const created = insertedRows[0];

    // Carry forward manpower + equipment from the last finalized DSR (submitted or
    // approved — both are on the record), editable in the new draft.
    const [lastDsr] = await tx
      .select({ id: dailyReports.id })
      .from(dailyReports)
      .where(
        and(
          eq(dailyReports.projectId, input.projectId),
          inArray(dailyReports.status, ["SUBMITTED", "APPROVED"]),
          isNull(dailyReports.deletedAt),
        ),
      )
      .orderBy(desc(dailyReports.reportDate))
      .limit(1);
    if (lastDsr) {
      const prevManpower = await tx
        .select({
          employeeId: dsrManpower.employeeId,
          tradeCode: dsrManpower.tradeCode,
          headcount: dsrManpower.headcount,
          hours: dsrManpower.hours,
        })
        .from(dsrManpower)
        .where(eq(dsrManpower.dailyReportId, lastDsr.id));
      if (prevManpower.length) {
        await tx
          .insert(dsrManpower)
          .values(prevManpower.map((m) => ({ ...m, dailyReportId: created.id })));
      }
      const prevEquipment = await tx
        .select({
          name: dsrEquipment.name,
          quantity: dsrEquipment.quantity,
          hours: dsrEquipment.hours,
          remarks: dsrEquipment.remarks,
        })
        .from(dsrEquipment)
        .where(eq(dsrEquipment.dailyReportId, lastDsr.id));
      if (prevEquipment.length) {
        await tx
          .insert(dsrEquipment)
          .values(prevEquipment.map((e) => ({ ...e, dailyReportId: created.id })));
      }
    }

    await audit(tx, {
      actorId: actor.id,
      action: "dsr.created",
      entityType: ENTITY,
      entityId: created.id,
      summary: `Started daily report ${refCode}`,
    });
    return { id: created.id, status: "DRAFT", created: true };
  },
);

// Debounced autosave: header + the full child sets replace the stored rows. No
// audit row (would flood the log); the submit is the audited event.
export const saveDsrDraftAction = action(
  "dsr.create",
  saveDsrDraftSchema,
  async (input, { user: actor, tx }) => {
    const dsr = await loadDsr(tx, input.id);
    if (!dsr) throw new ActionError("Report not found.");
    await assertProjectAccess(tx, {
      userId: actor.id,
      role: roleOf(actor),
      projectId: dsr.projectId,
    });
    if (dsr.status !== "DRAFT") {
      throw new ActionError("This report was submitted and can no longer be edited.");
    }
    assertCanEdit(actor, dsr);

    await tx
      .update(dailyReports)
      .set({
        weather: orNull(input.weather),
        workAccomplished: orNull(input.workAccomplished),
        nextDayPlan: orNull(input.nextDayPlan),
        progressNote: orNull(input.progressNote),
        updatedAt: new Date(),
      })
      .where(eq(dailyReports.id, input.id));

    await tx.delete(dsrManpower).where(eq(dsrManpower.dailyReportId, input.id));
    await tx.delete(dsrEquipment).where(eq(dsrEquipment.dailyReportId, input.id));
    await tx.delete(dsrMaterials).where(eq(dsrMaterials.dailyReportId, input.id));
    await tx.delete(dsrIssues).where(eq(dsrIssues.dailyReportId, input.id));
    if (input.manpower.length) {
      await tx.insert(dsrManpower).values(manpowerValues(input.id, input.manpower));
    }
    if (input.equipment.length) {
      await tx.insert(dsrEquipment).values(equipmentValues(input.id, input.equipment));
    }
    if (input.materials.length) {
      await tx.insert(dsrMaterials).values(materialValues(input.id, input.materials));
    }
    if (input.issues.length) {
      await tx.insert(dsrIssues).values(issueValues(input.id, input.issues));
    }

    return { ok: true };
  },
);

export const submitDsrAction = action(
  "dsr.create",
  dsrIdSchema,
  async (input, { user: actor, tx }) => {
    const dsr = await loadDsr(tx, input.id);
    if (!dsr) throw new ActionError("Report not found.");
    await assertProjectAccess(tx, {
      userId: actor.id,
      role: roleOf(actor),
      projectId: dsr.projectId,
    });
    if (dsr.status === "SUBMITTED") return { id: input.id };
    if (dsr.status !== "DRAFT") {
      throw new ActionError("Only a draft report can be submitted.");
    }
    assertCanEdit(actor, dsr);
    if (!dsr.workAccomplished || !dsr.workAccomplished.trim()) {
      throw new ActionError("Add what was accomplished before submitting.");
    }

    const now = new Date();
    // Clear any prior review trail: a report sent back and re-submitted reads as a
    // fresh submission awaiting review, not a stale "sent back" draft.
    await tx
      .update(dailyReports)
      .set({
        status: "SUBMITTED",
        submittedBy: actor.id,
        submittedAt: now,
        reviewRemarks: null,
        reviewedBy: null,
        reviewedAt: null,
        updatedAt: now,
      })
      .where(eq(dailyReports.id, input.id));

    await audit(tx, {
      actorId: actor.id,
      action: "dsr.submitted",
      entityType: ENTITY,
      entityId: input.id,
      summary: `Submitted daily report ${dsr.refCode}`,
    });
    await emitEvent(tx, {
      type: "dsr.submitted",
      payload: {
        entityType: ENTITY,
        entityId: input.id,
        projectId: dsr.projectId,
        actorId: actor.id,
        summary: `Daily report ${dsr.refCode} was submitted.`,
      },
    });

    const issues = await tx
      .select({ severity: dsrIssues.severity })
      .from(dsrIssues)
      .where(eq(dsrIssues.dailyReportId, input.id));
    if (hasHighSeverityIssue(issues)) {
      await emitEvent(tx, {
        type: "dsr.issue.flagged",
        payload: {
          entityType: ENTITY,
          entityId: input.id,
          projectId: dsr.projectId,
          actorId: actor.id,
          summary: `Daily report ${dsr.refCode} flagged a high-severity site issue.`,
        },
      });
    }

    return { id: input.id };
  },
);

// Reopen a locked report back to DRAFT for correction (logged). The author may
// reopen their own SUBMITTED report; an admin may reopen any SUBMITTED or APPROVED
// one. Guarded by dsr.create (engineers hold it); canReopenDsr is the fine-grained
// rule. Reopening clears the review trail so the fresh draft starts clean.
export const reopenDsrAction = action(
  "dsr.create",
  dsrIdSchema,
  async (input, { user: actor, tx }) => {
    const dsr = await loadDsr(tx, input.id);
    if (!dsr) throw new ActionError("Report not found.");
    await assertProjectAccess(tx, {
      userId: actor.id,
      role: roleOf(actor),
      projectId: dsr.projectId,
    });
    if (dsr.status === "DRAFT") return { id: input.id };
    if (!canReopenDsr({ id: actor.id, role: roleOf(actor) }, dsr)) {
      throw new ActionError("You can't reopen this report.");
    }

    await tx
      .update(dailyReports)
      .set({
        status: "DRAFT",
        submittedAt: null,
        reviewRemarks: null,
        reviewedBy: null,
        reviewedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(dailyReports.id, input.id));
    await audit(tx, {
      actorId: actor.id,
      action: "dsr.reopened",
      entityType: ENTITY,
      entityId: input.id,
      summary: `Re-opened daily report ${dsr.refCode}`,
    });
    return { id: input.id };
  },
);

// A reviewer (admin, dsr.review) decides on a SUBMITTED report: APPROVE it, or SEND
// it BACK for revision — which returns it to DRAFT carrying the remarks the author
// must address. Either way the author is notified (dsr.reviewed).
export const reviewDsrAction = action(
  "dsr.review",
  reviewDsrSchema,
  async (input, { user: actor, tx }) => {
    const dsr = await loadDsr(tx, input.id);
    if (!dsr) throw new ActionError("Report not found.");
    await assertProjectAccess(tx, {
      userId: actor.id,
      role: roleOf(actor),
      projectId: dsr.projectId,
    });
    if (dsr.status !== "SUBMITTED") {
      throw new ActionError("Only a submitted report can be reviewed.");
    }

    const now = new Date();
    const approved = input.outcome === "APPROVED";
    const review = {
      reviewRemarks: orNull(input.remarks),
      reviewedBy: actor.id,
      reviewedAt: now,
      updatedAt: now,
    };
    await tx
      .update(dailyReports)
      .set(
        approved
          ? { ...review, status: "APPROVED" as const }
          : { ...review, status: "DRAFT" as const, submittedAt: null },
      )
      .where(eq(dailyReports.id, input.id));

    await audit(tx, {
      actorId: actor.id,
      action: approved ? "dsr.approved" : "dsr.sent_back",
      entityType: ENTITY,
      entityId: input.id,
      summary: approved
        ? `Approved daily report ${dsr.refCode}`
        : `Sent daily report ${dsr.refCode} back for revision`,
    });
    if (dsr.createdBy && dsr.createdBy !== actor.id) {
      await emitEvent(tx, {
        type: "dsr.reviewed",
        payload: {
          entityType: ENTITY,
          entityId: input.id,
          projectId: dsr.projectId,
          authorId: dsr.createdBy,
          actorId: actor.id,
          summary: approved
            ? `Your daily report ${dsr.refCode} was approved.`
            : `Your daily report ${dsr.refCode} was sent back for revision.`,
        },
      });
    }
    return { id: input.id };
  },
);

// Soft-delete a report. An admin may delete any; the author may delete their own
// DRAFT. The partial unique index frees the deleted day's slot for a new report.
export const deleteDsrAction = action(
  "dsr.create",
  dsrIdSchema,
  async (input, { user: actor, tx }) => {
    const dsr = await loadDsr(tx, input.id);
    if (!dsr) throw new ActionError("Report not found.");
    await assertProjectAccess(tx, {
      userId: actor.id,
      role: roleOf(actor),
      projectId: dsr.projectId,
    });
    if (!canDeleteDsr({ id: actor.id, role: roleOf(actor) }, dsr)) {
      throw new ActionError("You can't delete this report.");
    }

    await tx
      .update(dailyReports)
      .set({ deletedAt: new Date() })
      .where(eq(dailyReports.id, input.id));
    await audit(tx, {
      actorId: actor.id,
      action: "dsr.deleted",
      entityType: ENTITY,
      entityId: input.id,
      summary: `Deleted daily report ${dsr.refCode}`,
    });
    return { id: input.id };
  },
);

// ── Photos (upload-on-pick via the polymorphic attachments table) ────────────
async function loadDsrForPhoto(db: Database, dsrId: string) {
  const [row] = await db
    .select({
      projectId: dailyReports.projectId,
      status: dailyReports.status,
      createdBy: dailyReports.createdBy,
      refCode: dailyReports.refCode,
      workAccomplished: dailyReports.workAccomplished,
    })
    .from(dailyReports)
    .where(and(eq(dailyReports.id, dsrId), isNull(dailyReports.deletedAt)))
    .limit(1);
  if (!row) throw new ActionError("Report not found.");
  return row;
}

export const presignDsrPhotoAction = actionNoTx(
  "dsr.create",
  presignDsrPhotoSchema,
  async (input, { user: actor, db }) => {
    const dsr = await loadDsrForPhoto(db, input.dsrId);
    await assertProjectAccess(db, {
      userId: actor.id,
      role: roleOf(actor),
      projectId: dsr.projectId,
    });
    if (dsr.status !== "DRAFT") throw new ActionError("This report can no longer be edited.");
    assertCanEdit(actor, dsr);
    return createPendingUpload(db, {
      entityType: ENTITY,
      entityId: input.dsrId,
      filename: input.filename,
      mime: input.mime,
      size: input.size,
      uploadedBy: actor.id,
    });
  },
);

export const confirmDsrPhotoAction = actionNoTx(
  "dsr.create",
  confirmDsrPhotoSchema,
  async (input, { user: actor, db }) => {
    const dsr = await loadDsrForPhoto(db, input.dsrId);
    await assertProjectAccess(db, {
      userId: actor.id,
      role: roleOf(actor),
      projectId: dsr.projectId,
    });
    assertCanEdit(actor, dsr);
    return confirmAttachment(db, {
      fileId: input.fileId,
      entityType: ENTITY,
      entityId: input.dsrId,
      label: input.name,
      actorId: actor.id,
      auditAction: "dsr.photo.added",
      auditSummary: `Added a photo to ${dsr.refCode}`,
    });
  },
);

export const getDsrPhotoUrlAction = actionNoTx(
  "dsr.view",
  dsrPhotoIdSchema,
  async (input, { user: actor, db }) => {
    const dsr = await loadDsrForPhoto(db, input.dsrId);
    await assertProjectAccess(db, {
      userId: actor.id,
      role: roleOf(actor),
      projectId: dsr.projectId,
    });
    return getAttachmentDownloadUrl(db, {
      attachmentId: input.attachmentId,
      entityType: ENTITY,
      entityId: input.dsrId,
    });
  },
);

export const deleteDsrPhotoAction = actionNoTx(
  "dsr.create",
  dsrPhotoIdSchema,
  async (input, { user: actor, db }) => {
    const dsr = await loadDsrForPhoto(db, input.dsrId);
    await assertProjectAccess(db, {
      userId: actor.id,
      role: roleOf(actor),
      projectId: dsr.projectId,
    });
    // Symmetry with adding a photo: a locked (SUBMITTED/APPROVED) report's evidence
    // can't be removed in place — reopen it to DRAFT first.
    if (dsr.status !== "DRAFT") throw new ActionError("This report can no longer be edited.");
    assertCanEdit(actor, dsr);
    await removeAttachment(db, {
      attachmentId: input.attachmentId,
      entityType: ENTITY,
      entityId: input.dsrId,
      actorId: actor.id,
      auditAction: "dsr.photo.removed",
      auditSummary: `Removed a photo from ${dsr.refCode}`,
    });
    return { ok: true };
  },
);

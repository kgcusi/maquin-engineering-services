"use server";

import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";

import type { Database } from "@/db/client";
import { phases } from "@/db/schema/phases";
import { projectMembers } from "@/db/schema/project-members";
import { projects } from "@/db/schema/projects";
import { tasks } from "@/db/schema/tasks";
import { orNull } from "@/lib/action-helpers";
import { audit, diffFields } from "@/lib/audit";
import { todayInTimeZone } from "@/lib/datetime";
import { emitEvent } from "@/lib/events";
import { ActionError, action, assertProjectAccess, hasPermission } from "@/lib/rbac";
import { progressForStatus, taskStatusLabel } from "@/lib/statuses";
import { getSettings } from "@/modules/settings/queries";

import { round2, shouldClearDelayed } from "./domain";
import {
  bulkUpdateTasksSchema,
  createPhaseSchema,
  createTaskSchema,
  phaseIdSchema,
  taskIdSchema,
  updatePhaseSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
  type CreateTaskInput,
} from "./schema";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

const roleOf = (u: { role?: string | null }) => u.role ?? null;
// "Today" in the firm's timezone (not UTC) — drives the delayed reset and the
// default for the status control's actual-date prompt.
const firmToday = async () => todayInTimeZone((await getSettings()).timezone);
// Phase progress = Σ(weight × progress) ÷ 100. A task's weight is its share of the
// phase, so any UNALLOCATED slice counts as not-done — a 70%-allocated phase tops
// out at 70% until the rest is allocated (it never overstates). When no task carries
// a weight (Σ = 0, the legacy default), it degrades to a plain average so phases
// that predate weighting keep their old number.
const PHASE_PROGRESS = sql<number>`
  case
    when coalesce(sum(${tasks.weightPct}), 0) = 0 then coalesce(avg(${tasks.progressPct}), 0)
    else sum(${tasks.weightPct} * ${tasks.progressPct}) / 100.0
  end::float8`;

// A task may only be assigned to a LEAD/MEMBER of its project — the action is the
// trust boundary, not the picker (the form already restricts the options). No-op
// when unassigned.
async function assertAssigneeIsMember(
  tx: Tx,
  projectId: string,
  assigneeId: string | null,
): Promise<void> {
  if (!assigneeId) return;
  const [member] = await tx
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, assigneeId),
        inArray(projectMembers.roleOnProject, ["LEAD", "MEMBER"]),
      ),
    )
    .limit(1);
  if (!member) throw new ActionError("Assign the task to someone on the project team.");
}

// ── Resolve the project an entity belongs to (for assertProjectAccess) ───────
async function resolvePhase(tx: Tx, phaseId: string): Promise<{ projectId: string } | null> {
  const [row] = await tx
    .select({ projectId: phases.projectId })
    .from(phases)
    .where(and(eq(phases.id, phaseId), isNull(phases.deletedAt)))
    .limit(1);
  return row ?? null;
}

async function resolveTask(
  tx: Tx,
  taskId: string,
): Promise<{
  phaseId: string;
  projectId: string;
  name: string;
  targetEndDate: string | null;
  assigneeId: string | null;
  isBlocked: boolean;
} | null> {
  const [row] = await tx
    .select({
      phaseId: tasks.phaseId,
      projectId: phases.projectId,
      name: tasks.name,
      targetEndDate: tasks.targetEndDate,
      assigneeId: tasks.assigneeId,
      isBlocked: tasks.isBlocked,
    })
    .from(tasks)
    .innerJoin(phases, eq(tasks.phaseId, phases.id))
    .where(and(eq(tasks.id, taskId), isNull(tasks.deletedAt)))
    .limit(1);
  return row ?? null;
}

// ── Progress roll-up (docs/17 §10.3): recompute phase then project IN ONE TX.
// Locks phase→project (consistent order) so two concurrent task edits can't lose
// an update. Project recompute = the simple average of its phases that actually
// have tasks (empty, not-yet-planned phases don't drag it down); skipped when
// progress is manually pinned. ───────────────────────────────────────────────
async function lockAndRecomputeProject(tx: Tx, projectId: string): Promise<void> {
  await tx
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.id, projectId))
    .for("update");
  const [proj] = await tx
    .select({ manual: projects.progressIsManual })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!proj || proj.manual) return;

  const [agg] = await tx
    .select({ avg: sql<number>`coalesce(avg(${phases.progressPct}), 0)::float8` })
    .from(phases)
    .where(
      and(
        eq(phases.projectId, projectId),
        isNull(phases.deletedAt),
        sql`exists (select 1 from ${tasks} where ${tasks.phaseId} = ${phases.id} and ${tasks.deletedAt} is null)`,
      ),
    );
  await tx
    .update(projects)
    .set({ progressPct: round2(agg.avg), updatedAt: new Date() })
    .where(eq(projects.id, projectId));
}

async function recomputePhase(tx: Tx, phaseId: string): Promise<void> {
  const [agg] = await tx
    .select({ avg: PHASE_PROGRESS })
    .from(tasks)
    .where(and(eq(tasks.phaseId, phaseId), isNull(tasks.deletedAt)));
  await tx
    .update(phases)
    .set({ progressPct: round2(agg.avg), updatedAt: new Date() })
    .where(eq(phases.id, phaseId));
}

// Roll up one or more phases then the project, in one tx. Phases are locked
// FOR UPDATE in a deterministic (sorted) order so two concurrent task moves
// between the same pair of phases can't deadlock (ABBA); the project is locked
// last by lockAndRecomputeProject.
async function rollUp(tx: Tx, projectId: string, phaseIds: string[]): Promise<void> {
  const unique = [...new Set(phaseIds)].sort();
  for (const id of unique) {
    await tx.select({ id: phases.id }).from(phases).where(eq(phases.id, id)).for("update");
  }
  for (const id of unique) await recomputePhase(tx, id);
  await lockAndRecomputeProject(tx, projectId);
}

const toTaskColumns = (input: CreateTaskInput) => {
  // A finished task can't also be blocked — completion wins over the block flag.
  const isBlocked = input.isBlocked && input.progressPct < 100;
  return {
    phaseId: input.phaseId,
    name: input.name,
    assigneeId: orNull(input.assigneeId),
    targetStartDate: orNull(input.targetStartDate),
    targetEndDate: orNull(input.targetEndDate),
    actualStartDate: orNull(input.actualStartDate),
    actualEndDate: orNull(input.actualEndDate),
    progressPct: input.progressPct,
    weightPct: input.weightPct,
    isBlocked,
    blockedReason: isBlocked ? orNull(input.blockedReason) : null,
    remarks: orNull(input.remarks),
  };
};

// Weight already committed to a phase (non-deleted tasks, optionally excluding the
// task being edited). Drives the "remaining unallocated" default and the over-
// allocation guard. A phase's task weights may never sum past 100.
const ALLOC_EPSILON = 0.001;

async function phaseAllocatedWeight(
  tx: Tx,
  phaseId: string,
  excludeTaskId?: string,
): Promise<number> {
  const conds = [eq(tasks.phaseId, phaseId), isNull(tasks.deletedAt)];
  if (excludeTaskId) conds.push(ne(tasks.id, excludeTaskId));
  const [row] = await tx
    .select({ total: sql<number>`coalesce(sum(${tasks.weightPct}), 0)::float8` })
    .from(tasks)
    .where(and(...conds));
  return row?.total ?? 0;
}

function assertWithinAllocation(allocatedOther: number, weight: number): void {
  if (weight > 0 && allocatedOther + weight > 100 + ALLOC_EPSILON) {
    const remaining = round2(Math.max(0, 100 - allocatedOther));
    throw new ActionError(`Only ${remaining}% of this phase is unallocated.`);
  }
}

// ── Task notification emits ──────────────────────────────────────────────────
// Both deliberately omit entityType/entityId from the payload, so the dispatcher
// scopes the idempotencyKey on the unique outbox row id: a re-assign, or a re-block
// after an unblock, notifies again instead of being deduped against the first
// emission (the same re-notify pattern as task.delayed). The actor is filtered out
// downstream, so assigning/blocking your own task never self-notifies.
async function emitTaskAssigned(
  tx: Tx,
  e: { taskId: string; projectId: string; assigneeId: string; taskName: string; actorId: string },
): Promise<void> {
  await emitEvent(tx, {
    type: "task.assigned",
    payload: {
      taskId: e.taskId,
      projectId: e.projectId,
      assigneeId: e.assigneeId,
      summary: `You were assigned the task "${e.taskName}".`,
      actorId: e.actorId,
    },
  });
}

async function emitTaskBlocked(
  tx: Tx,
  e: {
    taskId: string;
    projectId: string;
    taskName: string;
    reason: string | null;
    actorId: string;
  },
): Promise<void> {
  const reason = e.reason?.trim();
  await emitEvent(tx, {
    type: "task.blocked",
    payload: {
      taskId: e.taskId,
      projectId: e.projectId,
      summary: reason
        ? `Task "${e.taskName}" was blocked — ${reason}`
        : `Task "${e.taskName}" was blocked.`,
      actorId: e.actorId,
    },
  });
}

// ── Phases ──────────────────────────────────────────────────────────────────
export const createPhaseAction = action(
  "task.manage",
  createPhaseSchema,
  async (input, { user: actor, tx }) => {
    await assertProjectAccess(tx, {
      userId: actor.id,
      role: roleOf(actor),
      projectId: input.projectId,
    });
    const [created] = await tx
      .insert(phases)
      .values({
        projectId: input.projectId,
        name: input.name,
        sequence: input.sequence,
        targetStartDate: orNull(input.targetStartDate),
        targetEndDate: orNull(input.targetEndDate),
        actualStartDate: orNull(input.actualStartDate),
        actualEndDate: orNull(input.actualEndDate),
        remarks: orNull(input.remarks),
      })
      .returning({ id: phases.id });

    await audit(tx, {
      actorId: actor.id,
      action: "phase.created",
      entityType: "phase",
      entityId: created.id,
      summary: `Added phase ${input.name}`,
    });
    return { id: created.id };
  },
);

export const updatePhaseAction = action(
  "task.manage",
  updatePhaseSchema,
  async (input, { user: actor, tx }) => {
    const phase = await resolvePhase(tx, input.id);
    if (!phase) throw new ActionError("Phase not found.");
    await assertProjectAccess(tx, {
      userId: actor.id,
      role: roleOf(actor),
      projectId: phase.projectId,
    });

    await tx
      .update(phases)
      .set({
        name: input.name,
        sequence: input.sequence,
        targetStartDate: orNull(input.targetStartDate),
        targetEndDate: orNull(input.targetEndDate),
        actualStartDate: orNull(input.actualStartDate),
        actualEndDate: orNull(input.actualEndDate),
        remarks: orNull(input.remarks),
        updatedAt: new Date(),
      })
      .where(eq(phases.id, input.id));

    await audit(tx, {
      actorId: actor.id,
      action: "phase.updated",
      entityType: "phase",
      entityId: input.id,
      summary: `Updated phase ${input.name}`,
    });
    return { id: input.id };
  },
);

export const deletePhaseAction = action(
  "task.manage",
  phaseIdSchema,
  async (input, { user: actor, tx }) => {
    const [phase] = await tx
      .select({ projectId: phases.projectId, name: phases.name, deletedAt: phases.deletedAt })
      .from(phases)
      .where(eq(phases.id, input.id))
      .limit(1);
    if (!phase) throw new ActionError("Phase not found.");
    await assertProjectAccess(tx, {
      userId: actor.id,
      role: roleOf(actor),
      projectId: phase.projectId,
    });
    if (phase.deletedAt) return { id: input.id };

    const now = new Date();
    // Soft-delete the phase and its tasks together so neither counts toward roll-up.
    await tx.update(phases).set({ deletedAt: now }).where(eq(phases.id, input.id));
    await tx
      .update(tasks)
      .set({ deletedAt: now })
      .where(and(eq(tasks.phaseId, input.id), isNull(tasks.deletedAt)));

    await audit(tx, {
      actorId: actor.id,
      action: "phase.deleted",
      entityType: "phase",
      entityId: input.id,
      summary: `Deleted phase ${phase.name}`,
    });
    await lockAndRecomputeProject(tx, phase.projectId);
    return { id: input.id };
  },
);

// ── Tasks ───────────────────────────────────────────────────────────────────
export const createTaskAction = action(
  "task.manage",
  createTaskSchema,
  async (input, { user: actor, tx }) => {
    const phase = await resolvePhase(tx, input.phaseId);
    if (!phase) throw new ActionError("Phase not found.");
    await assertProjectAccess(tx, {
      userId: actor.id,
      role: roleOf(actor),
      projectId: phase.projectId,
    });
    await assertAssigneeIsMember(tx, phase.projectId, orNull(input.assigneeId));

    // Blank/zero weight on create → take whatever share of the phase is still
    // unallocated, so a new task lands in the pie instead of at an invisible 0. A
    // typed weight may not push the phase past 100%.
    const allocatedOther = await phaseAllocatedWeight(tx, input.phaseId);
    let weightPct = input.weightPct;
    if (weightPct <= 0) {
      weightPct = round2(Math.max(0, 100 - allocatedOther));
    } else {
      assertWithinAllocation(allocatedOther, weightPct);
    }

    const columns = toTaskColumns(input);
    const [created] = await tx
      .insert(tasks)
      .values({ ...columns, weightPct })
      .returning({ id: tasks.id });

    await audit(tx, {
      actorId: actor.id,
      action: "task.created",
      entityType: "task",
      entityId: created.id,
      summary: `Added task ${input.name}`,
    });
    if (columns.assigneeId) {
      await emitTaskAssigned(tx, {
        taskId: created.id,
        projectId: phase.projectId,
        assigneeId: columns.assigneeId,
        taskName: input.name,
        actorId: actor.id,
      });
    }
    if (columns.isBlocked) {
      await emitTaskBlocked(tx, {
        taskId: created.id,
        projectId: phase.projectId,
        taskName: input.name,
        reason: columns.blockedReason,
        actorId: actor.id,
      });
    }
    await rollUp(tx, phase.projectId, [input.phaseId]);
    return { id: created.id };
  },
);

export const updateTaskAction = action(
  "task.manage",
  updateTaskSchema,
  async (input, { user: actor, tx }) => {
    const current = await resolveTask(tx, input.id);
    if (!current) throw new ActionError("Task not found.");
    await assertProjectAccess(tx, {
      userId: actor.id,
      role: roleOf(actor),
      projectId: current.projectId,
    });

    // Moving between phases is allowed only WITHIN the same project.
    if (input.phaseId !== current.phaseId) {
      const dest = await resolvePhase(tx, input.phaseId);
      if (!dest || dest.projectId !== current.projectId) {
        throw new ActionError("Pick a phase in this project.");
      }
    }
    await assertAssigneeIsMember(tx, current.projectId, orNull(input.assigneeId));

    // Guard against the phase's weights summing past 100 (destination phase if moved).
    const allocatedOther = await phaseAllocatedWeight(tx, input.phaseId, input.id);
    assertWithinAllocation(allocatedOther, input.weightPct);

    const today = await firmToday();
    const targetEndDate = orNull(input.targetEndDate);
    const delayedReset = shouldClearDelayed(input.progressPct, targetEndDate, today)
      ? { isDelayed: false, delayedNotifiedAt: null }
      : {};
    const columns = toTaskColumns(input);

    await tx
      .update(tasks)
      .set({ ...columns, ...delayedReset, updatedAt: new Date() })
      .where(eq(tasks.id, input.id));

    await audit(tx, {
      actorId: actor.id,
      action: "task.updated",
      entityType: "task",
      entityId: input.id,
      summary: `Updated task ${input.name}`,
      diff: diffFields(
        { name: current.name, targetEndDate: current.targetEndDate },
        { name: input.name, targetEndDate },
      ),
    });

    // Notify on a NEW assignment and on a fresh block (false→true only, so editing
    // an already-assigned/already-blocked task doesn't re-notify).
    if (columns.assigneeId && columns.assigneeId !== current.assigneeId) {
      await emitTaskAssigned(tx, {
        taskId: input.id,
        projectId: current.projectId,
        assigneeId: columns.assigneeId,
        taskName: input.name,
        actorId: actor.id,
      });
    }
    if (columns.isBlocked && !current.isBlocked) {
      await emitTaskBlocked(tx, {
        taskId: input.id,
        projectId: current.projectId,
        taskName: input.name,
        reason: columns.blockedReason,
        actorId: actor.id,
      });
    }

    // One roll-up covering both the destination and (if moved) the source phase,
    // with deterministic lock ordering.
    await rollUp(tx, current.projectId, [input.phaseId, current.phaseId]);
    return { id: input.id };
  },
);

// Narrower assignee quick-path: set the task's status (docs/17 §10.14). The
// assignee updates their own task; a lead/admin (task.manage) may update anyone's.
// Blocked preserves the current progress and captures a reason (and notifies);
// the other three map to 0/50/100 and clear any block.
export const updateTaskStatusAction = action(
  "task.update.progress",
  updateTaskStatusSchema,
  async (input, { user: actor, tx }) => {
    const current = await resolveTask(tx, input.id);
    if (!current) throw new ActionError("Task not found.");
    await assertProjectAccess(tx, {
      userId: actor.id,
      role: roleOf(actor),
      projectId: current.projectId,
    });
    if (current.assigneeId !== actor.id && !hasPermission(roleOf(actor), "task.manage")) {
      throw new ActionError("Only the assignee can update this task's status.");
    }

    if (input.status === "BLOCKED") {
      // Blocking preserves progress — just flag it and capture the reason. The
      // weighted roll-up reads progress, which is unchanged, so nothing rolls up.
      await tx
        .update(tasks)
        .set({
          isBlocked: true,
          blockedReason: orNull(input.blockedReason),
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, input.id));

      await audit(tx, {
        actorId: actor.id,
        action: "task.blocked",
        entityType: "task",
        entityId: input.id,
        summary: `${current.name}: blocked`,
      });
      if (!current.isBlocked) {
        await emitTaskBlocked(tx, {
          taskId: input.id,
          projectId: current.projectId,
          taskName: current.name,
          reason: orNull(input.blockedReason),
          actorId: actor.id,
        });
      }
      return { id: input.id };
    }

    const progressPct = progressForStatus(input.status);
    const today = await firmToday();
    const delayedReset = shouldClearDelayed(progressPct, current.targetEndDate, today)
      ? { isDelayed: false, delayedNotifiedAt: null }
      : {};
    // Actual dates are MANUAL: the status prompt sends a date on the relevant
    // transition (→In progress sets actual start, →Done sets actual end), each
    // defaulting to today client-side. We only ever SET a date here — reopening a
    // task never clears a recorded actual (that's the engineer's to edit in the dialog).
    const actualDates = {
      ...(input.status === "IN_PROGRESS"
        ? { actualStartDate: orNull(input.actualStartDate) ?? today }
        : {}),
      ...(input.status === "DONE" ? { actualEndDate: orNull(input.actualEndDate) ?? today } : {}),
    };

    await tx
      .update(tasks)
      .set({
        progressPct,
        isBlocked: false,
        blockedReason: null,
        ...actualDates,
        ...delayedReset,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, input.id));

    await audit(tx, {
      actorId: actor.id,
      action: "task.status_updated",
      entityType: "task",
      entityId: input.id,
      summary: `${current.name}: ${taskStatusLabel(input.status).toLowerCase()}`,
    });
    await rollUp(tx, current.projectId, [current.phaseId]);
    return { id: input.id };
  },
);

// Bulk "edit all tasks in a phase" — the allocation workflow. Each row is the
// desired final state: update by id, insert when new, soft-delete anything the
// editor dropped. One roll-up at the end keeps phase/project progress consistent.
export const bulkUpdateTasksAction = action(
  "task.manage",
  bulkUpdateTasksSchema,
  async (input, { user: actor, tx }) => {
    const phase = await resolvePhase(tx, input.phaseId);
    if (!phase) throw new ActionError("Phase not found.");
    await assertProjectAccess(tx, {
      userId: actor.id,
      role: roleOf(actor),
      projectId: phase.projectId,
    });

    const totalWeight = input.rows.reduce((sum, r) => sum + (r.weightPct || 0), 0);
    if (totalWeight > 100 + ALLOC_EPSILON) {
      throw new ActionError(`Total allocation is ${round2(totalWeight)}% — it can't exceed 100%.`);
    }

    const existing = await tx
      .select({ id: tasks.id, targetEndDate: tasks.targetEndDate, assigneeId: tasks.assigneeId })
      .from(tasks)
      .where(and(eq(tasks.phaseId, input.phaseId), isNull(tasks.deletedAt)));
    const existingById = new Map(existing.map((t) => [t.id, t]));

    const today = await firmToday();
    const now = new Date();
    const keptIds = new Set<string>();

    for (const row of input.rows) {
      await assertAssigneeIsMember(tx, phase.projectId, orNull(row.assigneeId));

      const newAssignee = orNull(row.assigneeId);
      const targetStartDate = orNull(row.targetStartDate);
      const targetEndDate = orNull(row.targetEndDate);
      const prev = row.id ? existingById.get(row.id) : undefined;
      if (row.id && prev) {
        keptIds.add(row.id);
        const delayedReset = shouldClearDelayed(row.progressPct, targetEndDate, today)
          ? { isDelayed: false, delayedNotifiedAt: null }
          : {};
        await tx
          .update(tasks)
          .set({
            name: row.name,
            assigneeId: newAssignee,
            targetStartDate,
            targetEndDate,
            weightPct: row.weightPct,
            progressPct: row.progressPct,
            // A finished task can't stay blocked (the grid doesn't set the flag).
            ...(row.progressPct >= 100 ? { isBlocked: false, blockedReason: null } : {}),
            ...delayedReset,
            updatedAt: now,
          })
          .where(eq(tasks.id, row.id));
        // Notify on a new/changed assignee, same as the single-task edit path.
        if (newAssignee && newAssignee !== prev.assigneeId) {
          await emitTaskAssigned(tx, {
            taskId: row.id,
            projectId: phase.projectId,
            assigneeId: newAssignee,
            taskName: row.name,
            actorId: actor.id,
          });
        }
      } else {
        const [created] = await tx
          .insert(tasks)
          .values({
            phaseId: input.phaseId,
            name: row.name,
            assigneeId: newAssignee,
            targetStartDate,
            targetEndDate,
            weightPct: row.weightPct,
            progressPct: row.progressPct,
          })
          .returning({ id: tasks.id });
        keptIds.add(created.id);
        if (newAssignee) {
          await emitTaskAssigned(tx, {
            taskId: created.id,
            projectId: phase.projectId,
            assigneeId: newAssignee,
            taskName: row.name,
            actorId: actor.id,
          });
        }
      }
    }

    const removed = existing.filter((t) => !keptIds.has(t.id)).map((t) => t.id);
    if (removed.length) {
      await tx.update(tasks).set({ deletedAt: now }).where(inArray(tasks.id, removed));
    }

    await audit(tx, {
      actorId: actor.id,
      action: "task.bulk_updated",
      entityType: "phase",
      entityId: input.phaseId,
      summary: `Updated tasks for a phase (${input.rows.length} ${
        input.rows.length === 1 ? "task" : "tasks"
      })`,
    });
    await rollUp(tx, phase.projectId, [input.phaseId]);
    return { phaseId: input.phaseId };
  },
);

export const deleteTaskAction = action(
  "task.manage",
  taskIdSchema,
  async (input, { user: actor, tx }) => {
    const current = await resolveTask(tx, input.id);
    if (!current) throw new ActionError("Task not found.");
    await assertProjectAccess(tx, {
      userId: actor.id,
      role: roleOf(actor),
      projectId: current.projectId,
    });

    await tx.update(tasks).set({ deletedAt: new Date() }).where(eq(tasks.id, input.id));
    await audit(tx, {
      actorId: actor.id,
      action: "task.deleted",
      entityType: "task",
      entityId: input.id,
      summary: `Deleted task ${current.name}`,
    });
    await rollUp(tx, current.projectId, [current.phaseId]);
    return { id: input.id };
  },
);

"use server";

import { and, eq, isNull, sql } from "drizzle-orm";

import type { Database } from "@/db/client";
import { phases } from "@/db/schema/phases";
import { projects } from "@/db/schema/projects";
import { tasks } from "@/db/schema/tasks";
import { orNull } from "@/lib/action-helpers";
import { audit, diffFields } from "@/lib/audit";
import { ActionError, action, assertProjectAccess, hasPermission } from "@/lib/rbac";

import { round2, shouldClearDelayed } from "./domain";
import {
  createPhaseSchema,
  createTaskSchema,
  phaseIdSchema,
  taskIdSchema,
  updatePhaseSchema,
  updateTaskProgressSchema,
  updateTaskSchema,
  type CreateTaskInput,
} from "./schema";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

const todayISO = () => new Date().toISOString().slice(0, 10);
const roleOf = (u: { role?: string | null }) => u.role ?? null;
const PROGRESS_AVG = sql<number>`coalesce(avg(${tasks.progressPct}), 0)::float8`;

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
  dueDate: string | null;
  assigneeId: string | null;
} | null> {
  const [row] = await tx
    .select({
      phaseId: tasks.phaseId,
      projectId: phases.projectId,
      name: tasks.name,
      dueDate: tasks.dueDate,
      assigneeId: tasks.assigneeId,
    })
    .from(tasks)
    .innerJoin(phases, eq(tasks.phaseId, phases.id))
    .where(and(eq(tasks.id, taskId), isNull(tasks.deletedAt)))
    .limit(1);
  return row ?? null;
}

// ── Progress roll-up (docs/17 §10.3): recompute phase then project IN ONE TX.
// Locks phase→project (consistent order) so two concurrent task edits can't lose
// an update. Project recompute = avg of ALL its tasks (= task-count-weighted avg
// of phases); skipped when progress is manually pinned. ──────────────────────
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
    .select({ avg: PROGRESS_AVG })
    .from(tasks)
    .innerJoin(phases, eq(tasks.phaseId, phases.id))
    .where(and(eq(phases.projectId, projectId), isNull(tasks.deletedAt), isNull(phases.deletedAt)));
  await tx
    .update(projects)
    .set({ progressPct: round2(agg.avg), updatedAt: new Date() })
    .where(eq(projects.id, projectId));
}

async function rollUpProgress(tx: Tx, projectId: string, phaseId: string): Promise<void> {
  await tx.select({ id: phases.id }).from(phases).where(eq(phases.id, phaseId)).for("update");
  const [agg] = await tx
    .select({ avg: PROGRESS_AVG })
    .from(tasks)
    .where(and(eq(tasks.phaseId, phaseId), isNull(tasks.deletedAt)));
  await tx
    .update(phases)
    .set({ progressPct: round2(agg.avg), updatedAt: new Date() })
    .where(eq(phases.id, phaseId));

  await lockAndRecomputeProject(tx, projectId);
}

const toTaskColumns = (input: CreateTaskInput) => ({
  phaseId: input.phaseId,
  name: input.name,
  assigneeId: orNull(input.assigneeId),
  startDate: orNull(input.startDate),
  dueDate: orNull(input.dueDate),
  progressPct: input.progressPct,
  isBlocked: input.isBlocked,
  blockedReason: input.isBlocked ? orNull(input.blockedReason) : null,
  remarks: orNull(input.remarks),
});

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
        startDate: orNull(input.startDate),
        targetEndDate: orNull(input.targetEndDate),
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
        startDate: orNull(input.startDate),
        targetEndDate: orNull(input.targetEndDate),
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

    const completedDate = input.progressPct >= 100 ? todayISO() : null;
    const [created] = await tx
      .insert(tasks)
      .values({ ...toTaskColumns(input), completedDate })
      .returning({ id: tasks.id });

    await audit(tx, {
      actorId: actor.id,
      action: "task.created",
      entityType: "task",
      entityId: created.id,
      summary: `Added task ${input.name}`,
    });
    await rollUpProgress(tx, phase.projectId, input.phaseId);
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

    const dueDate = orNull(input.dueDate);
    const completedDate = input.progressPct >= 100 ? todayISO() : null;
    const delayedReset = shouldClearDelayed(input.progressPct, dueDate, todayISO())
      ? { isDelayed: false, delayedNotifiedAt: null }
      : {};

    await tx
      .update(tasks)
      .set({ ...toTaskColumns(input), completedDate, ...delayedReset, updatedAt: new Date() })
      .where(eq(tasks.id, input.id));

    await audit(tx, {
      actorId: actor.id,
      action: "task.updated",
      entityType: "task",
      entityId: input.id,
      summary: `Updated task ${input.name}`,
      diff: diffFields(
        { name: current.name, dueDate: current.dueDate },
        { name: input.name, dueDate },
      ),
    });

    await rollUpProgress(tx, current.projectId, input.phaseId);
    if (input.phaseId !== current.phaseId) {
      await rollUpProgress(tx, current.projectId, current.phaseId);
    }
    return { id: input.id };
  },
);

// Narrower assignee quick-path: progress only. The assignee updates their own
// task; a lead/admin (task.manage) may update anyone's (docs/17 §10.14).
export const updateTaskProgressAction = action(
  "task.update.progress",
  updateTaskProgressSchema,
  async (input, { user: actor, tx }) => {
    const current = await resolveTask(tx, input.id);
    if (!current) throw new ActionError("Task not found.");
    await assertProjectAccess(tx, {
      userId: actor.id,
      role: roleOf(actor),
      projectId: current.projectId,
    });
    if (current.assigneeId !== actor.id && !hasPermission(roleOf(actor), "task.manage")) {
      throw new ActionError("Only the assignee can update this task's progress.");
    }

    const completedDate = input.progressPct >= 100 ? todayISO() : null;
    const delayedReset = shouldClearDelayed(input.progressPct, current.dueDate, todayISO())
      ? { isDelayed: false, delayedNotifiedAt: null }
      : {};

    await tx
      .update(tasks)
      .set({
        progressPct: input.progressPct,
        completedDate,
        ...delayedReset,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, input.id));

    await audit(tx, {
      actorId: actor.id,
      action: "task.progress_updated",
      entityType: "task",
      entityId: input.id,
      summary: `${current.name}: progress set to ${input.progressPct}%`,
    });
    await rollUpProgress(tx, current.projectId, current.phaseId);
    return { id: input.id };
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
    await rollUpProgress(tx, current.projectId, current.phaseId);
    return { id: input.id };
  },
);

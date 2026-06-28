import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { user } from "@/db/schema/auth";
import { phases } from "@/db/schema/phases";
import { projectMembers } from "@/db/schema/project-members";
import { tasks } from "@/db/schema/tasks";

// These reads are always reached through the access-gated project detail page
// (getProjectDetail already proved the viewer may see this project), so they take
// an already-authorized projectId.

export type TaskRow = {
  id: string;
  phaseId: string;
  name: string;
  assigneeId: string | null;
  assigneeName: string | null;
  targetStartDate: string | null;
  targetEndDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  progressPct: number;
  weightPct: number;
  isBlocked: boolean;
  blockedReason: string | null;
  isDelayed: boolean;
  remarks: string | null;
};

export type PhaseWithTasks = {
  id: string;
  name: string;
  sequence: number;
  targetStartDate: string | null;
  targetEndDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  progressPct: number;
  remarks: string | null;
  tasks: TaskRow[];
};

export async function listPhasesWithTasks(projectId: string): Promise<PhaseWithTasks[]> {
  const phaseRows = await db
    .select({
      id: phases.id,
      name: phases.name,
      sequence: phases.sequence,
      targetStartDate: phases.targetStartDate,
      targetEndDate: phases.targetEndDate,
      actualStartDate: phases.actualStartDate,
      actualEndDate: phases.actualEndDate,
      progressPct: phases.progressPct,
      remarks: phases.remarks,
    })
    .from(phases)
    .where(and(eq(phases.projectId, projectId), isNull(phases.deletedAt)))
    .orderBy(asc(phases.sequence), asc(phases.name));

  if (phaseRows.length === 0) return [];

  const phaseIds = phaseRows.map((p) => p.id);
  const taskRows = await db
    .select({
      id: tasks.id,
      phaseId: tasks.phaseId,
      name: tasks.name,
      assigneeId: tasks.assigneeId,
      assigneeName: user.name,
      targetStartDate: tasks.targetStartDate,
      targetEndDate: tasks.targetEndDate,
      actualStartDate: tasks.actualStartDate,
      actualEndDate: tasks.actualEndDate,
      progressPct: tasks.progressPct,
      weightPct: tasks.weightPct,
      isBlocked: tasks.isBlocked,
      blockedReason: tasks.blockedReason,
      isDelayed: tasks.isDelayed,
      remarks: tasks.remarks,
    })
    .from(tasks)
    .leftJoin(user, eq(tasks.assigneeId, user.id))
    .where(and(inArray(tasks.phaseId, phaseIds), isNull(tasks.deletedAt)))
    .orderBy(asc(tasks.targetEndDate), asc(tasks.createdAt));

  const byPhase = new Map<string, TaskRow[]>();
  for (const t of taskRows) {
    const list = byPhase.get(t.phaseId) ?? [];
    list.push(t);
    byPhase.set(t.phaseId, list);
  }

  return phaseRows.map((p) => ({ ...p, tasks: byPhase.get(p.id) ?? [] }));
}

/** Project members (lead + members) as task-assignee options. */
export function listProjectAssigneeOptions(
  projectId: string,
): Promise<{ id: string; name: string }[]> {
  return db
    .select({ id: projectMembers.userId, name: user.name })
    .from(projectMembers)
    .innerJoin(user, eq(projectMembers.userId, user.id))
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        inArray(projectMembers.roleOnProject, ["LEAD", "MEMBER"]),
      ),
    )
    .orderBy(asc(user.name));
}

// Count helper used by the delayed-job tests / dashboards later — open tasks past
// due as of a given date, scoped to a project.
export async function countOpenPastDue(projectId: string, today: string): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(tasks)
    .innerJoin(phases, eq(tasks.phaseId, phases.id))
    .where(
      and(
        eq(phases.projectId, projectId),
        isNull(tasks.deletedAt),
        sql`${tasks.progressPct} < 100`,
        sql`${tasks.targetEndDate} < ${today}`,
      ),
    );
  return row?.value ?? 0;
}

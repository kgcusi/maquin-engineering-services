import { and, asc, eq, isNull } from "drizzle-orm";

import type { Database } from "@/db/client";
import { phases } from "@/db/schema/phases";
import {
  projectTemplatePhases,
  projectTemplateTasks,
  projectTemplates,
} from "@/db/schema/project-templates";
import { tasks } from "@/db/schema/tasks";
import { ActionError } from "@/lib/rbac";

import { chainPhaseSchedule, isPhaseOverAllocated, phaseWeightTotal } from "./domain";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export type InstantiateTemplateArgs = {
  projectId: string;
  templateId: string;
  /** Calendar-day chain anchor — `YYYY-MM-DD`. */
  startDate: string;
  /** User-adjusted durations from the review step, keyed by template phase id. */
  durationOverrides?: Map<string, number>;
  /** The final task list per phase (template-seeded + the user's review-step edits),
   *  keyed by template phase id. When a phase is absent, its stored template tasks
   *  are used as-is (docs/17 §10.17). */
  tasksByPhase?: Map<string, { name: string; weightPct: number }[]>;
};

/**
 * Clone a template's phase/task tree onto a project, computing a sequential
 * calendar-day schedule from `startDate` (docs/17 §10.17). MUST run inside the
 * caller's transaction so the project + all phases + tasks are one atomic write.
 * A SNAPSHOT — the inserted rows are independent of the template thereafter.
 */
export async function instantiateTemplate(
  tx: Tx,
  args: InstantiateTemplateArgs,
): Promise<{ phaseCount: number; taskCount: number }> {
  const [template] = await tx
    .select({ id: projectTemplates.id })
    .from(projectTemplates)
    .where(and(eq(projectTemplates.id, args.templateId), isNull(projectTemplates.deletedAt)))
    .limit(1);
  if (!template) throw new ActionError("Template not found.");

  const phaseRows = await tx
    .select({
      id: projectTemplatePhases.id,
      name: projectTemplatePhases.name,
      sequence: projectTemplatePhases.sequence,
      durationDays: projectTemplatePhases.durationDays,
    })
    .from(projectTemplatePhases)
    .where(eq(projectTemplatePhases.templateId, args.templateId))
    .orderBy(asc(projectTemplatePhases.sequence));
  if (!phaseRows.length) throw new ActionError("This template has no phases.");

  const overrides = args.durationOverrides ?? new Map<string, number>();
  const tasksByPhase =
    args.tasksByPhase ?? new Map<string, { name: string; weightPct: number }[]>();
  const durations = phaseRows.map((p) => overrides.get(p.id) ?? p.durationDays);
  const schedule = chainPhaseSchedule(args.startDate, durations);

  let taskCount = 0;
  for (let i = 0; i < phaseRows.length; i++) {
    const phase = phaseRows[i];
    const sched = schedule[i];
    const [insertedPhase] = await tx
      .insert(phases)
      .values({
        projectId: args.projectId,
        name: phase.name,
        sequence: phase.sequence,
        targetStartDate: sched.targetStartDate,
        targetEndDate: sched.targetEndDate,
      })
      .returning({ id: phases.id });

    // The client sends the full (editable) task list per phase; fall back to the
    // template's stored tasks when a phase wasn't included in the payload.
    const taskList =
      tasksByPhase.get(phase.id) ??
      (await tx
        .select({
          name: projectTemplateTasks.name,
          weightPct: projectTemplateTasks.weightPct,
        })
        .from(projectTemplateTasks)
        .where(eq(projectTemplateTasks.templatePhaseId, phase.id))
        .orderBy(asc(projectTemplateTasks.sequence)));

    // Task weights may never top 100% of the phase — the review-step UI blocks this,
    // but the action is a public POST, so guard it here too (an over-allocated phase
    // would later overflow its progress_pct CHECK(0–100)).
    const allocated = phaseWeightTotal(taskList.map((t) => t.weightPct));
    if (isPhaseOverAllocated(allocated)) {
      throw new ActionError(
        `Phase "${phase.name}" is over-allocated (${allocated}% of 100%). Lower a task's weight.`,
      );
    }

    if (taskList.length) {
      await tx.insert(tasks).values(
        taskList.map((t) => ({
          phaseId: insertedPhase.id,
          name: t.name,
          weightPct: t.weightPct,
        })),
      );
      taskCount += taskList.length;
    }
  }

  return { phaseCount: phaseRows.length, taskCount };
}

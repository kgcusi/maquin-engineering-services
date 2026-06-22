import { and, eq, isNull, sql } from "drizzle-orm";

import type { Database } from "@/db/client";
import { phases } from "@/db/schema/phases";
import { projects } from "@/db/schema/projects";
import { tasks } from "@/db/schema/tasks";
import { emitEvent } from "@/lib/events";

import { todayISO } from "../dsr/domain";

// Nightly delay scan (docs/17 §10.7). Flips is_delayed false→true for newly
// past-due open tasks and emits ONE `task.delayed` per transition — idempotent and
// re-run-safe via the stored transition flag (re-checked under FOR UPDATE) plus the
// outbox idempotencyKey. The read path derives delayed for display and never writes
// the flag; the task-edit path resets it on completion/re-date so a later slip
// re-notifies.
//
// The emitted payload carries NO entityId on purpose: the dispatcher then scopes the
// idempotencyKey on the unique outbox row id, so a fresh slip of the same task (after
// a reset) is a distinct notification rather than being deduped against the prior one.
const SCAN_LIMIT = 500;

export async function runDelayedTaskScan(
  db: Database,
): Promise<{ scanned: number; flagged: number }> {
  const today = todayISO();

  const candidates = await db
    .select({ id: tasks.id, name: tasks.name, projectId: phases.projectId })
    .from(tasks)
    .innerJoin(phases, eq(tasks.phaseId, phases.id))
    .innerJoin(projects, eq(phases.projectId, projects.id))
    .where(
      and(
        isNull(tasks.deletedAt),
        isNull(phases.deletedAt),
        isNull(projects.deletedAt),
        eq(tasks.isDelayed, false),
        sql`${tasks.progressPct} < 100`,
        sql`${tasks.dueDate} is not null and ${tasks.dueDate} < ${today}`,
      ),
    )
    .limit(SCAN_LIMIT);

  let flagged = 0;
  for (const task of candidates) {
    await db.transaction(async (tx) => {
      // Re-check under a row lock so two overlapping runs can't double-flag/notify.
      const [row] = await tx
        .select({ isDelayed: tasks.isDelayed })
        .from(tasks)
        .where(eq(tasks.id, task.id))
        .limit(1)
        .for("update");
      if (!row || row.isDelayed) return;

      await tx
        .update(tasks)
        .set({ isDelayed: true, delayedNotifiedAt: new Date() })
        .where(eq(tasks.id, task.id));

      await emitEvent(tx, {
        type: "task.delayed",
        payload: {
          taskId: task.id,
          projectId: task.projectId,
          summary: `Task "${task.name}" is past its due date.`,
        },
      });
      flagged += 1;
    });
  }

  return { scanned: candidates.length, flagged };
}

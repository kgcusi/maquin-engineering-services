"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { deriveTaskStatus, type TaskStatus } from "@/lib/statuses";
import { cn } from "@/lib/utils";
import type { PhaseWithTasks } from "@/modules/projects/tasks/queries";

// Solid fills matching the status badges: emerald done / primary in-progress /
// amber blocked / muted not-started. `dot` paints the legend swatch, `stroke` the
// donut arc.
const SEGMENT_META: Record<TaskStatus, { label: string; dot: string; stroke: string }> = {
  DONE: { label: "Done", dot: "bg-emerald-500", stroke: "stroke-emerald-500" },
  IN_PROGRESS: { label: "In progress", dot: "bg-primary", stroke: "stroke-primary" },
  BLOCKED: { label: "Blocked", dot: "bg-amber-500", stroke: "stroke-amber-500" },
  NOT_STARTED: {
    label: "Not started",
    dot: "bg-muted-foreground/40",
    stroke: "stroke-muted-foreground/40",
  },
};

// Drawing order = donut sweep order (clockwise from 12 o'clock).
const ORDER: TaskStatus[] = ["DONE", "IN_PROGRESS", "BLOCKED", "NOT_STARTED"];

export function TaskStatusDonut({ phases }: { phases: PhaseWithTasks[] }) {
  const tasks = phases.flatMap((p) => p.tasks);
  const total = tasks.length;

  const counts: Record<TaskStatus, number> = {
    NOT_STARTED: 0,
    IN_PROGRESS: 0,
    BLOCKED: 0,
    DONE: 0,
  };
  for (const t of tasks) counts[deriveTaskStatus(t.progressPct, t.isBlocked)] += 1;

  // Pre-compute each arc's sweep length + start offset (% of the ring) so the JSX
  // map stays pure — no offset accumulator reassigned mid-render.
  const segments = ORDER.map((key, i) => ({
    key,
    value: (counts[key] / total) * 100,
    offset: (ORDER.slice(0, i).reduce((sum, k) => sum + counts[k], 0) / (total || 1)) * 100,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Task status</CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No tasks yet — add tasks to a phase to track status here.
          </p>
        ) : (
          <div className="flex items-center gap-5">
            <div className="relative shrink-0">
              <svg viewBox="0 0 40 40" className="size-28 -rotate-90">
                <circle
                  cx="20"
                  cy="20"
                  r="16"
                  fill="none"
                  className="stroke-muted"
                  strokeWidth="5"
                />
                {segments.map(({ key, value, offset }) =>
                  value <= 0 ? null : (
                    <circle
                      key={key}
                      cx="20"
                      cy="20"
                      r="16"
                      fill="none"
                      pathLength={100}
                      strokeWidth="5"
                      strokeLinecap="butt"
                      className={SEGMENT_META[key].stroke}
                      strokeDasharray={`${value} ${100 - value}`}
                      strokeDashoffset={-offset}
                    />
                  ),
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl leading-none font-semibold tabular-nums">{total}</span>
                <span className="text-muted-foreground text-[0.7rem]">
                  {total === 1 ? "task" : "tasks"}
                </span>
              </div>
            </div>
            <ul className="min-w-0 flex-1 space-y-1.5">
              {ORDER.map((key) => (
                <li key={key} className="flex items-center gap-2 text-sm">
                  <span
                    className={cn("size-2.5 shrink-0 rounded-sm", SEGMENT_META[key].dot)}
                    aria-hidden
                  />
                  <span className="text-muted-foreground truncate">{SEGMENT_META[key].label}</span>
                  <span className="ml-auto shrink-0 font-medium tabular-nums">{counts[key]}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

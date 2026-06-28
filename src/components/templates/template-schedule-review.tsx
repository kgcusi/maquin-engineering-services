"use client";

import { useMemo } from "react";
import { CalendarRange, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { round2 } from "@/modules/projects/tasks/domain";
import {
  chainPhaseSchedule,
  isPhaseOverAllocated,
  phaseWeightTotal,
} from "@/modules/projects/templates/domain";
import type { TemplateTree } from "@/modules/projects/templates/queries";

// One review row per template phase: an editable duration, the computed
// start → end window, and a fully editable task list seeded from the template
// (rename / reweight / remove / add). Phases stay bound to the template — only the
// duration and the task list are adjustable here.
export type PhaseDurationState = { templatePhaseId: string; durationDays: number };
// A task in the review-step editor. `key` is a client-only React id; `weightPct` is
// its share of the phase (0 = unallocated, like any untouched task).
export type EditableTask = { key: string; name: string; weightPct: number };

// Seed the editable task list from a template's tree, keyed by template phase id.
// Both creation flows (new project / apply-to-empty) call this when a template is
// chosen so the form opens with the template's tasks already editable.
export function seedEditableTasks(template: TemplateTree): Record<string, EditableTask[]> {
  return Object.fromEntries(
    template.phases.map((p) => [
      p.id,
      p.tasks.map((t) => ({ key: crypto.randomUUID(), name: t.name, weightPct: t.weightPct })),
    ]),
  );
}

const dateFmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

function formatRange(startIso: string, endIso: string): string {
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
    return `${startIso} → ${endIso}`;
  return `${dateFmt.format(start)} → ${dateFmt.format(end)}`;
}

// Inclusive span in calendar days for a phase window (matches chainPhaseSchedule).
function spanDays(startIso: string, endIso: string): number {
  const a = Date.parse(`${startIso}T00:00:00Z`);
  const b = Date.parse(`${endIso}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

export function TemplateScheduleReview({
  template,
  startDate,
  durations,
  onDurationChange,
  tasksByPhase,
  onTasksChange,
  disabled,
}: {
  template: TemplateTree;
  /** "YYYY-MM-DD" anchor for phase 1, or "" if not yet chosen. */
  startDate: string;
  /** Per-phase duration overrides, parallel to template.phases. */
  durations: PhaseDurationState[];
  onDurationChange: (templatePhaseId: string, days: number) => void;
  /** The editable task list per phase, keyed by template phase id. Seeded from the
   *  template when chosen; the full list is sent on submit (template tasks are NOT
   *  re-read server-side, so removing/reweighting one just works). */
  tasksByPhase: Record<string, EditableTask[]>;
  onTasksChange: (templatePhaseId: string, tasks: EditableTask[]) => void;
  disabled?: boolean;
}) {
  const durationByPhase = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of durations) map.set(d.templatePhaseId, d.durationDays);
    return map;
  }, [durations]);

  const orderedDurations = template.phases.map((p) => durationByPhase.get(p.id) ?? p.durationDays);

  const hasStart = /^\d{4}-\d{2}-\d{2}$/.test(startDate);
  const schedule = hasStart ? chainPhaseSchedule(startDate, orderedDurations) : null;

  const totalDays = orderedDurations.reduce((sum, d) => sum + Math.max(1, Math.trunc(d || 0)), 0);
  const projectEnd = schedule?.at(-1)?.targetEndDate ?? null;

  return (
    <div className="space-y-3">
      {!hasStart ? (
        <p className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          <CalendarRange className="size-4 shrink-0" />
          Pick a start date to schedule the phases.
        </p>
      ) : null}

      <ol className="divide-border overflow-hidden rounded-lg border">
        {template.phases.map((phase, index) => {
          const days = durationByPhase.get(phase.id) ?? phase.durationDays;
          const window = schedule?.[index] ?? null;
          const tasks = tasksByPhase[phase.id] ?? [];
          return (
            <li
              key={phase.id}
              className="border-border space-y-2.5 border-b px-3.5 py-3 last:border-b-0"
            >
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="text-muted-foreground bg-muted flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold tabular-nums">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{phase.name}</p>
                    {window ? (
                      <p className="text-muted-foreground flex items-center gap-1.5 text-xs tabular-nums">
                        <CalendarRange className="size-3.5 shrink-0" />
                        {formatRange(window.targetStartDate, window.targetEndDate)}
                        <span aria-hidden>·</span>
                        {spanDays(window.targetStartDate, window.targetEndDate)} days
                      </p>
                    ) : (
                      <p className="text-muted-foreground text-xs">
                        {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Label
                    htmlFor={`dur-${phase.id}`}
                    className="text-muted-foreground text-xs font-normal"
                  >
                    days
                  </Label>
                  <Input
                    id={`dur-${phase.id}`}
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={String(days)}
                    disabled={disabled}
                    onChange={(e) => {
                      const next = Math.max(1, Math.trunc(Number(e.target.value) || 1));
                      onDurationChange(phase.id, next);
                    }}
                    aria-label={`Duration for ${phase.name} in days`}
                    className="h-8 w-20 text-right tabular-nums"
                  />
                </div>
              </div>

              <PhaseTasks
                phaseName={phase.name}
                tasks={tasks}
                onChange={(next) => onTasksChange(phase.id, next)}
                disabled={disabled}
              />
            </li>
          );
        })}
      </ol>

      {schedule && projectEnd ? (
        <p className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-xs">
          <span className="text-foreground font-medium tabular-nums">{totalDays} days</span>
          across {template.phases.length} {template.phases.length === 1 ? "phase" : "phases"}
          <span aria-hidden>·</span>
          finishes{" "}
          <span className="text-foreground font-medium tabular-nums">
            {formatRange(projectEnd, projectEnd).split(" → ")[0]}
          </span>
        </p>
      ) : null}
    </div>
  );
}

// The editable task list for one phase. Seeded from the template, but every row is
// editable — rename, reweight, remove — and rows can be added. The hint shows the
// phase's combined allocation; blank-name rows are filtered out by the caller on
// submit, so an empty row is harmless.
function PhaseTasks({
  phaseName,
  tasks,
  onChange,
  disabled,
}: {
  phaseName: string;
  tasks: EditableTask[];
  onChange: (tasks: EditableTask[]) => void;
  disabled?: boolean;
}) {
  const allocated = phaseWeightTotal(tasks.map((t) => t.weightPct));
  const over = isPhaseOverAllocated(allocated);
  const unallocated = round2(Math.max(0, 100 - allocated));

  return (
    <div className="space-y-1.5 pl-8.5">
      {tasks.length === 0 ? (
        <p className="text-muted-foreground text-xs italic">No tasks yet — add one below.</p>
      ) : (
        tasks.map((task) => (
          <div key={task.key} className="flex items-center gap-2">
            <Input
              value={task.name}
              onChange={(e) =>
                onChange(
                  tasks.map((t) => (t.key === task.key ? { ...t, name: e.target.value } : t)),
                )
              }
              disabled={disabled}
              maxLength={160}
              placeholder="Task name"
              aria-label={`Task name under ${phaseName}`}
              className="h-7 text-xs"
            />
            <div className="relative shrink-0">
              <Input
                type="number"
                min={0}
                max={100}
                inputMode="decimal"
                value={task.weightPct ? String(task.weightPct) : ""}
                onChange={(e) => {
                  const next = round2(Math.max(0, Math.min(100, Number(e.target.value) || 0)));
                  onChange(tasks.map((t) => (t.key === task.key ? { ...t, weightPct: next } : t)));
                }}
                disabled={disabled}
                placeholder="0"
                aria-label={`Weight percent for a task under ${phaseName}`}
                aria-invalid={over}
                className="h-7 w-16 pr-5 text-right text-xs tabular-nums"
              />
              <span
                className="text-muted-foreground pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs"
                aria-hidden
              >
                %
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Remove task"
              disabled={disabled}
              onClick={() => onChange(tasks.filter((t) => t.key !== task.key))}
              className="text-muted-foreground hover:text-destructive shrink-0"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))
      )}
      {tasks.length > 0 ? (
        <p
          className={cn(
            "text-xs tabular-nums",
            over ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {over
            ? `Over-allocated by ${round2(allocated - 100)}% — trim to 100%.`
            : `${allocated}% of phase allocated · ${unallocated}% unallocated`}
        </p>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="text-muted-foreground"
        disabled={disabled}
        onClick={() => onChange([...tasks, { key: crypto.randomUUID(), name: "", weightPct: 0 }])}
      >
        <Plus className="size-3" /> Add task
      </Button>
    </div>
  );
}

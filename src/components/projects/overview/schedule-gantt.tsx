"use client";

import { useState } from "react";
import { CalendarRange, ChevronDown, ListTree } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { todayInTimeZone } from "@/lib/datetime";
import { barState, datePos, expectedProgressPct, spanBounds, type BarState } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import { round2 } from "@/modules/projects/tasks/domain";
import type { PhaseWithTasks } from "@/modules/projects/tasks/queries";

// Solid actual-bar colour by schedule health — mirrors the status palette used by
// the badges (emerald done / amber behind / red overdue / green on-track).
const ACTUAL_TONE: Record<BarState, string> = {
  done: "bg-emerald-500",
  overdue: "bg-destructive",
  behind: "bg-amber-500",
  on_track: "bg-primary",
};

const MONTH_FMT = new Intl.DateTimeFormat(undefined, { month: "short" });
const DATE_FMT = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

function parseLocal(iso: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmt(iso: string | null): string {
  const d = parseLocal(iso);
  return d ? DATE_FMT.format(d) : "—";
}

type Schedulable = {
  targetStartDate: string | null;
  targetEndDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  progressPct: number;
};

type Bars = {
  target: { left: number; width: number; title: string } | null;
  actual: { left: number; width: number; title: string; tone: string } | null;
  hasDates: boolean;
};

function computeBars(item: Schedulable, min: number, max: number, today: string): Bars {
  const tL = datePos(item.targetStartDate, min, max);
  const tR = datePos(item.targetEndDate, min, max);
  const target =
    tL != null && tR != null
      ? {
          left: Math.min(tL, tR),
          width: Math.abs(tR - tL),
          title: `Target: ${fmt(item.targetStartDate)} → ${fmt(item.targetEndDate)}`,
        }
      : null;

  // Open work (started, not done) runs to "today"; a finished slice with no end
  // date also falls back to today so the bar still renders.
  const actualEnd = item.actualEndDate ?? (item.actualStartDate ? today : null);
  const aL = datePos(item.actualStartDate, min, max);
  const aR = datePos(actualEnd, min, max);
  const expected = expectedProgressPct(item.targetStartDate, item.targetEndDate, today);
  const actual =
    aL != null && aR != null
      ? {
          left: Math.min(aL, aR),
          width: Math.abs(aR - aL),
          title: `Actual: ${fmt(item.actualStartDate)} → ${
            item.actualEndDate ? fmt(item.actualEndDate) : "in progress"
          }`,
          tone: ACTUAL_TONE[barState(item.progressPct, item.targetEndDate, expected, today)],
        }
      : null;

  return { target, actual, hasDates: target != null || actual != null };
}

type Tick = { left: number; label: string };

function monthTicks(min: number, max: number): Tick[] {
  const start = new Date(min);
  const ticks: Tick[] = [];
  let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  let first = true;
  while (cursor.getTime() <= max) {
    const pos = datePos(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-01`,
      min,
      max,
    );
    if (pos != null) {
      const showYear = first || cursor.getMonth() === 0;
      ticks.push({
        left: pos,
        label: showYear
          ? `${MONTH_FMT.format(cursor)} ${cursor.getFullYear()}`
          : MONTH_FMT.format(cursor),
      });
    }
    first = false;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return ticks;
}

function GanttTrack({
  ticks,
  todayPos,
  bars,
  className,
  emptyHint,
}: {
  ticks: Tick[];
  todayPos: number | null;
  bars: Bars;
  className?: string;
  emptyHint?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      {ticks.map((t) => (
        <div
          key={t.left}
          className="bg-border/60 absolute inset-y-0 w-px"
          style={{ left: `${t.left}%` }}
          aria-hidden
        />
      ))}
      {todayPos != null ? (
        <div
          className="bg-destructive/50 absolute inset-y-0 w-px"
          style={{ left: `${todayPos}%` }}
          aria-hidden
        />
      ) : null}
      {bars.target ? (
        <div
          className="ring-foreground/[0.06] bg-muted-foreground/15 absolute inset-y-0 rounded-md ring-1 ring-inset"
          style={{
            left: `${bars.target.left}%`,
            width: `${bars.target.width}%`,
            minWidth: "0.35rem",
          }}
          title={bars.target.title}
        />
      ) : null}
      {bars.actual ? (
        <div
          className={cn("absolute top-1/2 h-[50%] -translate-y-1/2 rounded-md", bars.actual.tone)}
          style={{
            left: `${bars.actual.left}%`,
            width: `${bars.actual.width}%`,
            minWidth: "0.35rem",
          }}
          title={bars.actual.title}
        />
      ) : null}
      {!bars.hasDates && emptyHint ? (
        <span className="text-muted-foreground/60 absolute inset-0 flex items-center pl-2 text-[0.7rem]">
          {emptyHint}
        </span>
      ) : null}
    </div>
  );
}

const LABEL_COL = "grid-cols-[10.5rem_minmax(0,1fr)] sm:grid-cols-[13rem_minmax(0,1fr)]";

function PhaseRow({
  phase,
  index,
  min,
  max,
  today,
  ticks,
  todayPos,
}: {
  phase: PhaseWithTasks;
  index: number;
  min: number;
  max: number;
  today: string;
  ticks: Tick[];
  todayPos: number | null;
}) {
  const [open, setOpen] = useState(false);
  const hasTasks = phase.tasks.length > 0;
  const bars = computeBars(phase, min, max, today);

  return (
    <div className="border-border/70 border-b last:border-b-0">
      <div className={cn("grid items-center gap-2 py-2", LABEL_COL)}>
        <div className="flex min-w-0 items-center gap-1.5">
          {hasTasks ? (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label={`${open ? "Collapse" : "Expand"} ${phase.name} tasks`}
              className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
            >
              <ChevronDown className={cn("size-3.5 transition-transform", !open && "-rotate-90")} />
            </button>
          ) : (
            <span className="size-3.5 shrink-0" aria-hidden />
          )}
          <span className="text-muted-foreground/70 w-4 shrink-0 text-right text-xs tabular-nums">
            {index + 1}
          </span>
          <span className="truncate text-sm font-medium" title={phase.name}>
            {phase.name}
          </span>
          <span className="text-muted-foreground ml-auto shrink-0 text-xs tabular-nums">
            {round2(phase.progressPct)}%
          </span>
        </div>
        <GanttTrack
          ticks={ticks}
          todayPos={todayPos}
          bars={bars}
          className="h-9"
          emptyHint="No dates set"
        />
      </div>

      {open && hasTasks ? (
        <ul className="pb-1">
          {phase.tasks.map((task) => {
            const taskBars = computeBars(task, min, max, today);
            return (
              <li key={task.id} className={cn("grid items-center gap-2 py-1", LABEL_COL)}>
                <div className="flex min-w-0 items-center gap-1.5 pl-7">
                  <span className="text-muted-foreground truncate text-xs" title={task.name}>
                    {task.name}
                  </span>
                  <span className="text-muted-foreground/80 ml-auto shrink-0 text-[0.7rem] tabular-nums">
                    {round2(task.progressPct)}%
                  </span>
                </div>
                <GanttTrack ticks={ticks} todayPos={todayPos} bars={taskBars} className="h-7" />
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function LegendDot({ className }: { className: string }) {
  return <span className={cn("size-2.5 rounded-sm", className)} aria-hidden />;
}

function GanttLegend({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "text-muted-foreground flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        <LegendDot className="bg-muted-foreground/25 ring-foreground/[0.04] ring-1 ring-inset" />{" "}
        Target
      </span>
      <span className="inline-flex items-center gap-1.5">
        <LegendDot className="bg-primary" /> On track
      </span>
      <span className="inline-flex items-center gap-1.5">
        <LegendDot className="bg-amber-500" /> Behind
      </span>
      <span className="inline-flex items-center gap-1.5">
        <LegendDot className="bg-destructive" /> Overdue
      </span>
      <span className="inline-flex items-center gap-1.5">
        <LegendDot className="bg-emerald-500" /> Done
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="bg-destructive/60 h-3 w-px" aria-hidden /> Today
      </span>
    </div>
  );
}

export function ScheduleGantt({
  phases,
  timeZone,
  onOpenPhases,
}: {
  phases: PhaseWithTasks[];
  timeZone: string;
  onOpenPhases: () => void;
}) {
  const today = todayInTimeZone(timeZone);

  const allDates = phases.flatMap((p) => [
    p.targetStartDate,
    p.targetEndDate,
    p.actualStartDate,
    p.actualEndDate,
    ...p.tasks.flatMap((t) => [
      t.targetStartDate,
      t.targetEndDate,
      t.actualStartDate,
      t.actualEndDate,
    ]),
  ]);
  const bounds = spanBounds(allDates);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CalendarRange className="text-muted-foreground size-4" />
          <CardTitle>Schedule — target vs actual</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {phases.length === 0 || !bounds ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-12 text-center">
            <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full">
              <ListTree className="size-5" />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {phases.length === 0 ? "No phases yet" : "No scheduled dates yet"}
              </p>
              <p className="text-muted-foreground mx-auto max-w-sm text-sm">
                {phases.length === 0
                  ? "Lay out the work breakdown to plot the project timeline."
                  : "Add target start and end dates to phases and tasks to plot the timeline."}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={onOpenPhases}>
              <ListTree /> Go to Phases &amp; Tasks
            </Button>
          </div>
        ) : (
          (() => {
            // Pad the domain out to whole-month boundaries so the gridlines line up
            // with the month labels.
            const minDate = new Date(bounds.min);
            const maxDate = new Date(bounds.max);
            const min = new Date(minDate.getFullYear(), minDate.getMonth(), 1).getTime();
            const max = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 1).getTime();
            const ticks = monthTicks(min, max);
            const todayMs = parseLocal(today)?.getTime() ?? null;
            const todayPos =
              todayMs != null && todayMs >= min && todayMs <= max ? datePos(today, min, max) : null;

            return (
              <>
                <div className="overflow-x-auto">
                  <div className="min-w-[40rem]">
                    <div className={cn("grid gap-2", LABEL_COL)}>
                      <div />
                      <div className="text-muted-foreground relative mb-1 h-4 text-[0.7rem]">
                        {ticks.map((t) => (
                          <span
                            key={t.left}
                            className="absolute pl-1 whitespace-nowrap tabular-nums"
                            style={{ left: `${t.left}%` }}
                          >
                            {t.label}
                          </span>
                        ))}
                      </div>
                    </div>
                    {phases.map((phase, i) => (
                      <PhaseRow
                        key={phase.id}
                        phase={phase}
                        index={i}
                        min={min}
                        max={max}
                        today={today}
                        ticks={ticks}
                        todayPos={todayPos}
                      />
                    ))}
                  </div>
                </div>
                <GanttLegend className="mt-4" />
              </>
            );
          })()
        )}
      </CardContent>
    </Card>
  );
}

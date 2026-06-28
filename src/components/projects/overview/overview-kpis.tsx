"use client";

import type { ReactNode } from "react";
import {
  CalendarClock,
  ClipboardList,
  Gauge,
  Layers,
  ListChecks,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { todayInTimeZone } from "@/lib/datetime";
import { expectedProgressPct, scheduleVariance } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import type { DsrStatusCounts } from "@/modules/projects/dsr/queries";
import type { InspectionStatusCounts } from "@/modules/projects/inspections/queries";
import { isTaskDelayed } from "@/modules/projects/tasks/domain";
import type { PhaseWithTasks } from "@/modules/projects/tasks/queries";
import type { ProjectDetail } from "@/modules/projects/queries";

function StatCard({
  icon: Icon,
  label,
  value,
  valueTone,
  sub,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  valueTone?: string;
  sub?: ReactNode;
}) {
  return (
    <Card size="sm" className="justify-between gap-2">
      <CardContent className="space-y-2">
        <div className="text-muted-foreground flex items-center gap-1.5">
          <Icon className="size-3.5 shrink-0" />
          <span className="text-[0.7rem] font-medium tracking-wide uppercase">{label}</span>
        </div>
        <div
          className={cn(
            "text-2xl leading-none font-semibold tracking-tight tabular-nums",
            valueTone ?? "text-foreground",
          )}
        >
          {value}
        </div>
        {sub ? <div className="text-muted-foreground text-xs">{sub}</div> : null}
      </CardContent>
    </Card>
  );
}

function MiniBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
      <div
        className={cn("h-full rounded-full", clamped >= 100 ? "bg-emerald-500" : "bg-primary")}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function OverviewKpis({
  project,
  phases,
  dsrSummary,
  inspectionSummary,
  canViewInspections,
  timeZone,
}: {
  project: ProjectDetail;
  phases: PhaseWithTasks[];
  dsrSummary: DsrStatusCounts;
  inspectionSummary: InspectionStatusCounts;
  canViewInspections: boolean;
  timeZone: string;
}) {
  const today = todayInTimeZone(timeZone);

  const tasks = phases.flatMap((p) => p.tasks);
  const taskTotal = tasks.length;
  const tasksDone = tasks.filter((t) => t.progressPct >= 100).length;
  const tasksBlocked = tasks.filter((t) => t.isBlocked && t.progressPct < 100).length;
  const tasksDelayed = tasks.filter((t) =>
    isTaskDelayed(t.progressPct, t.targetEndDate, t.isDelayed, today),
  ).length;

  const phaseTotal = phases.length;
  const phasesDone = phases.filter((p) => p.progressPct >= 100).length;

  const expected = expectedProgressPct(project.startDate, project.targetEndDate, today);
  const variance = scheduleVariance(project.progressPct, expected);
  const gap = Math.round(Math.abs(variance.delta));

  const schedule: { value: string; tone: string; sub: ReactNode } =
    expected == null
      ? { value: "—", tone: "text-muted-foreground", sub: "Set project dates" }
      : {
          value:
            variance.state === "ahead"
              ? `Ahead ${gap}%`
              : variance.state === "behind"
                ? `Behind ${gap}%`
                : "On track",
          tone:
            variance.state === "behind"
              ? "text-amber-600 dark:text-amber-400"
              : variance.state === "ahead"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-foreground",
          sub: `${Math.round(project.progressPct)}% done · ${Math.round(expected)}% expected by today`,
        };

  const taskSub =
    taskTotal === 0 ? (
      "No tasks yet"
    ) : tasksBlocked || tasksDelayed ? (
      <span className="space-x-2">
        {tasksDelayed ? (
          <span className="text-destructive font-medium">{tasksDelayed} delayed</span>
        ) : null}
        {tasksBlocked ? (
          <span className="text-amber-600 dark:text-amber-400">{tasksBlocked} blocked</span>
        ) : null}
      </span>
    ) : (
      "All on schedule"
    );

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      <StatCard
        icon={Gauge}
        label="Overall progress"
        value={`${Math.round(project.progressPct)}%`}
        sub={<MiniBar pct={project.progressPct} />}
      />
      <StatCard
        icon={CalendarClock}
        label="Schedule"
        value={schedule.value}
        valueTone={schedule.tone}
        sub={schedule.sub}
      />
      <StatCard
        icon={ListChecks}
        label="Tasks done"
        value={taskTotal === 0 ? "0" : `${tasksDone}/${taskTotal}`}
        sub={taskSub}
      />
      <StatCard
        icon={Layers}
        label="Phases done"
        value={phaseTotal === 0 ? "0" : `${phasesDone}/${phaseTotal}`}
        sub={phaseTotal === 0 ? "No phases yet" : "phases complete"}
      />
      <StatCard
        icon={ClipboardList}
        label="Daily reports"
        value={dsrSummary.total}
        sub={
          dsrSummary.total === 0
            ? "None logged yet"
            : `${dsrSummary.approved} approved · ${dsrSummary.submitted} submitted · ${dsrSummary.draft} draft`
        }
      />
      {canViewInspections ? (
        <StatCard
          icon={ShieldCheck}
          label="Inspections"
          value={inspectionSummary.total}
          sub={
            inspectionSummary.total === 0 ? (
              "None requested"
            ) : (
              <span className="space-x-2">
                <span className="text-emerald-600 dark:text-emerald-400">
                  {inspectionSummary.passed} passed
                </span>
                {inspectionSummary.failed ? (
                  <span className="text-destructive font-medium">
                    {inspectionSummary.failed} failed
                  </span>
                ) : null}
                {inspectionSummary.requested ? (
                  <span>{inspectionSummary.requested} open</span>
                ) : null}
              </span>
            )
          }
        />
      ) : null}
    </div>
  );
}

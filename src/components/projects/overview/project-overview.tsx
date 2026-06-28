"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OverviewKpis } from "@/components/projects/overview/overview-kpis";
import { ProjectDetailsPanel } from "@/components/projects/overview/project-details-panel";
import { ScheduleGantt } from "@/components/projects/overview/schedule-gantt";
import { TaskStatusDonut } from "@/components/projects/overview/task-status-donut";
import { ProjectStatusBadge } from "@/components/projects/project-status-badge";
import { ProjectStatusControl } from "@/components/projects/project-status-control";
import { ProjectTeam } from "@/components/projects/project-team";
import type { ProjectStatus } from "@/lib/statuses";
import type { DsrStatusCounts } from "@/modules/projects/dsr/queries";
import type { InspectionStatusCounts } from "@/modules/projects/inspections/queries";
import type { ProjectDetail } from "@/modules/projects/queries";
import type { PhaseWithTasks } from "@/modules/projects/tasks/queries";

export function ProjectOverview({
  project,
  phases,
  currency,
  timeZone,
  canManage,
  dsrSummary,
  inspectionSummary,
  canViewInspections,
  onOpenPhases,
}: {
  project: ProjectDetail;
  phases: PhaseWithTasks[];
  currency: string;
  timeZone: string;
  canManage: boolean;
  dsrSummary: DsrStatusCounts;
  inspectionSummary: InspectionStatusCounts;
  canViewInspections: boolean;
  onOpenPhases: () => void;
}) {
  const status = project.status as ProjectStatus;
  // Open = not yet Done; drives the status control's "complete anyway?" warning.
  const openTasks = phases.flatMap((p) => p.tasks).filter((t) => t.progressPct < 100);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Status
        </span>
        {canManage ? (
          <ProjectStatusControl
            projectId={project.id}
            status={status}
            openTaskCount={openTasks.length}
            blockedTaskCount={openTasks.filter((t) => t.isBlocked).length}
          />
        ) : (
          <ProjectStatusBadge status={status} />
        )}
      </div>

      <OverviewKpis
        project={project}
        phases={phases}
        dsrSummary={dsrSummary}
        inspectionSummary={inspectionSummary}
        canViewInspections={canViewInspections}
        timeZone={timeZone}
      />

      <ScheduleGantt phases={phases} timeZone={timeZone} onOpenPhases={onOpenPhases} />

      <div className="grid gap-6 lg:grid-cols-3">
        <TaskStatusDonut phases={phases} />
        <ProjectDetailsPanel project={project} currency={currency} timeZone={timeZone} />
        <Card>
          <CardHeader>
            <CardTitle>Team</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectTeam members={project.members} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

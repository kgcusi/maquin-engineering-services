import type { Route } from "next";
import {
  CalendarClock,
  ClipboardList,
  FolderKanban,
  Inbox,
  ListChecks,
  OctagonAlert,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { Link } from "react-transition-progress/next";

import { KpiCard } from "@/components/dashboard/kpi-card";
import { DashboardProjectList } from "@/components/dashboard/project-list";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import type { Dashboard } from "@/modules/dashboard/queries";

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="font-heading text-sm font-medium">{title}</h2>
        {action}
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

function PanelEmpty({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Inbox;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <Icon className="text-muted-foreground/50 size-7" strokeWidth={1.75} />
      <p className="text-sm font-medium">{title}</p>
      <p className="text-muted-foreground max-w-xs text-xs text-balance">{description}</p>
    </div>
  );
}

const viewAll = (
  <Link
    href={"/projects" as Route}
    className="text-muted-foreground hover:text-foreground text-xs font-medium"
  >
    View all
  </Link>
);

export function DashboardSummary({ dashboard }: { dashboard: Dashboard }) {
  const activity =
    dashboard.activity.length > 0 ? (
      <RecentActivity items={dashboard.activity} />
    ) : (
      <PanelEmpty
        icon={Inbox}
        title="No recent activity"
        description="Assignments, reviews, and alerts will show up here as they happen."
      />
    );

  if (dashboard.kind === "engineer") {
    const { kpis, projects } = dashboard;
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Open tasks" value={kpis.openTasks} icon={ListChecks} />
          <KpiCard label="Overdue" value={kpis.overdueTasks} icon={CalendarClock} tone="danger" />
          <KpiCard label="Blocked" value={kpis.blockedTasks} icon={OctagonAlert} tone="warning" />
          <KpiCard label="My projects" value={kpis.projectCount} icon={FolderKanban} />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Panel title="My projects" action={projects.length > 0 ? viewAll : undefined}>
              {projects.length > 0 ? (
                <DashboardProjectList rows={projects} />
              ) : (
                <PanelEmpty
                  icon={FolderKanban}
                  title="No projects assigned to you yet"
                  description="When an admin adds you to a site, it appears here with its schedule and daily reports."
                />
              )}
            </Panel>
          </div>
          <Panel title="Recent activity">{activity}</Panel>
        </div>
      </div>
    );
  }

  const { kpis, atRisk } = dashboard;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Active projects" value={kpis.activeProjects} icon={FolderKanban} />
        <KpiCard label="At risk" value={kpis.atRiskProjects} icon={TriangleAlert} tone="danger" />
        <KpiCard
          label="DSRs to review"
          value={kpis.pendingDsrReviews}
          icon={ClipboardList}
          tone="warning"
        />
        <KpiCard
          label="Overdue tasks"
          value={kpis.overdueTasks}
          icon={CalendarClock}
          tone="danger"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="Needs attention" action={atRisk.length > 0 ? viewAll : undefined}>
            {atRisk.length > 0 ? (
              <DashboardProjectList rows={atRisk} />
            ) : (
              <PanelEmpty
                icon={ShieldCheck}
                title="Everything's on track"
                description="No active project has overdue or blocked work right now."
              />
            )}
          </Panel>
        </div>
        <Panel title="Recent activity">{activity}</Panel>
      </div>
    </div>
  );
}

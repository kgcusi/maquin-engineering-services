import { and, count, eq, isNull, notInArray, or, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { dailyReports } from "@/db/schema/daily-reports";
import { phases } from "@/db/schema/phases";
import { projects } from "@/db/schema/projects";
import { tasks } from "@/db/schema/tasks";
import { todayInTimeZone } from "@/lib/datetime";
import { hasPermission, projectAccessWhere } from "@/lib/rbac";
import { listRecentNotifications, type BellNotification } from "@/modules/notifications/queries";
import { getSettings } from "@/modules/settings/queries";

import {
  compareByUrgency,
  mergeProjectTaskCounts,
  sumTaskCounts,
  type DashboardProjectRow,
} from "./domain";

// The personal landing. DYNAMIC + auth-scoped (no `use cache` — it reads the
// session), so it lives inside a <Suspense> boundary on the page. Every read is
// scoped: admins (`project.view.all`) see firm-wide aggregates; everyone else is
// filtered to their `project_members` rows (`projectAccessWhere`) and to tasks
// assigned to them. The `dashboard:{userId}` cache tag stays unused on purpose —
// user-scoped session reads stay dynamic (docs/16 §7).

const ACTIVITY_LIMIT = 6;
const AT_RISK_LIMIT = 8;
const TERMINAL_STATUSES = ["COMPLETED", "CANCELLED"] as const;

export type DashboardViewer = { id: string; role: string | null };

export type EngineerDashboard = {
  kind: "engineer";
  kpis: { openTasks: number; overdueTasks: number; blockedTasks: number; projectCount: number };
  projects: DashboardProjectRow[];
  activity: BellNotification[];
};

export type AdminDashboard = {
  kind: "admin";
  kpis: {
    activeProjects: number;
    atRiskProjects: number;
    pendingDsrReviews: number;
    overdueTasks: number;
  };
  atRisk: DashboardProjectRow[];
  activity: BellNotification[];
};

export type Dashboard = EngineerDashboard | AdminDashboard;

export async function getDashboard(viewer: DashboardViewer): Promise<Dashboard> {
  const today = todayInTimeZone((await getSettings()).timezone);
  return hasPermission(viewer.role, "project.view.all")
    ? getAdminDashboard(viewer, today)
    : getEngineerDashboard(viewer, today);
}

async function getEngineerDashboard(
  viewer: DashboardViewer,
  today: string,
): Promise<EngineerDashboard> {
  const overdue = sql`${tasks.targetEndDate} is not null and ${tasks.targetEndDate} < ${today}`;

  const [projectRows, countRows, activity] = await Promise.all([
    // Every project I belong to — even ones with no task of mine, so the list is my
    // whole site roster, not just where I have open work.
    db
      .select({
        id: projects.id,
        refCode: projects.refCode,
        name: projects.name,
        status: projects.status,
        progressPct: projects.progressPct,
      })
      .from(projects)
      .where(and(isNull(projects.deletedAt), projectAccessWhere(viewer.role, viewer.id))),
    // My open tasks, counted per project (an assignee is always a project member, so
    // filtering by assignee is itself the scope).
    db
      .select({
        projectId: phases.projectId,
        openTasks: sql<number>`count(*)::int`,
        overdueTasks: sql<number>`sum(case when ${overdue} then 1 else 0 end)::int`,
        blockedTasks: sql<number>`sum(case when ${tasks.isBlocked} then 1 else 0 end)::int`,
      })
      .from(tasks)
      .innerJoin(phases, eq(tasks.phaseId, phases.id))
      .where(
        and(
          eq(tasks.assigneeId, viewer.id),
          isNull(tasks.deletedAt),
          isNull(phases.deletedAt),
          sql`${tasks.progressPct} < 100`,
        ),
      )
      .groupBy(phases.projectId),
    listRecentNotifications(viewer.id, ACTIVITY_LIMIT),
  ]);

  const merged = mergeProjectTaskCounts(projectRows, countRows).sort(compareByUrgency);
  const totals = sumTaskCounts(merged);

  return {
    kind: "engineer",
    kpis: {
      openTasks: totals.openTasks,
      overdueTasks: totals.overdueTasks,
      blockedTasks: totals.blockedTasks,
      projectCount: merged.length,
    },
    projects: merged,
    activity,
  };
}

async function getAdminDashboard(viewer: DashboardViewer, today: string): Promise<AdminDashboard> {
  const open = sql`${tasks.progressPct} < 100`;
  const overdue = sql`${tasks.targetEndDate} is not null and ${tasks.targetEndDate} < ${today}`;

  const [activeProjects, atRiskRows, pendingDsr, overdueTasks, activity] = await Promise.all([
    db
      .select({ value: count() })
      .from(projects)
      .where(and(isNull(projects.deletedAt), notInArray(projects.status, [...TERMINAL_STATUSES]))),
    // Live projects carrying open work that's overdue or blocked — each returned row
    // is "at risk" by construction (the HAVING is the WHERE on the grouped tasks).
    db
      .select({
        id: projects.id,
        refCode: projects.refCode,
        name: projects.name,
        status: projects.status,
        progressPct: projects.progressPct,
        overdueTasks: sql<number>`sum(case when ${overdue} then 1 else 0 end)::int`,
        blockedTasks: sql<number>`sum(case when ${tasks.isBlocked} then 1 else 0 end)::int`,
      })
      .from(projects)
      .innerJoin(phases, eq(phases.projectId, projects.id))
      .innerJoin(tasks, eq(tasks.phaseId, phases.id))
      .where(
        and(
          isNull(projects.deletedAt),
          notInArray(projects.status, [...TERMINAL_STATUSES]),
          isNull(phases.deletedAt),
          isNull(tasks.deletedAt),
          open,
          or(overdue, eq(tasks.isBlocked, true)),
        ),
      )
      .groupBy(projects.id, projects.refCode, projects.name, projects.status, projects.progressPct),
    db
      .select({ value: count() })
      .from(dailyReports)
      .innerJoin(projects, eq(dailyReports.projectId, projects.id))
      .where(
        and(
          eq(dailyReports.status, "SUBMITTED"),
          isNull(dailyReports.deletedAt),
          isNull(projects.deletedAt),
        ),
      ),
    db
      .select({ value: count() })
      .from(tasks)
      .innerJoin(phases, eq(tasks.phaseId, phases.id))
      .innerJoin(projects, eq(phases.projectId, projects.id))
      .where(
        and(
          isNull(tasks.deletedAt),
          isNull(phases.deletedAt),
          isNull(projects.deletedAt),
          open,
          overdue,
        ),
      ),
    listRecentNotifications(viewer.id, ACTIVITY_LIMIT),
  ]);

  const atRisk: DashboardProjectRow[] = atRiskRows
    .map((r) => ({ ...r, openTasks: 0 }))
    .sort(compareByUrgency);

  return {
    kind: "admin",
    kpis: {
      activeProjects: activeProjects[0]?.value ?? 0,
      atRiskProjects: atRisk.length,
      pendingDsrReviews: pendingDsr[0]?.value ?? 0,
      overdueTasks: overdueTasks[0]?.value ?? 0,
    },
    atRisk: atRisk.slice(0, AT_RISK_LIMIT),
    activity,
  };
}

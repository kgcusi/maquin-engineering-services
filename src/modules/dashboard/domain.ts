// Pure dashboard shaping — NO server imports, so it's unit-tested in domain.test.ts
// and stays free of the DB. The scoped *counting* happens in queries.ts (raw SQL
// filtered by membership / assignee); these functions only decide how the rows
// become the at-a-glance model: merge per-project counts, classify "at risk", and
// order the lists by urgency. Keeping that logic here is what makes it testable
// without a database (the repo has no DB-backed test harness).

export type ProjectTaskCounts = {
  openTasks: number;
  overdueTasks: number;
  blockedTasks: number;
};

export type ProjectSummary = {
  id: string;
  refCode: string;
  name: string;
  status: string;
  progressPct: number;
};

export type DashboardProjectRow = ProjectSummary & ProjectTaskCounts;

const ZERO: ProjectTaskCounts = { openTasks: 0, overdueTasks: 0, blockedTasks: 0 };

/** A project needs attention when it has open work that's overdue or blocked. */
export function isProjectAtRisk(
  c: Pick<ProjectTaskCounts, "overdueTasks" | "blockedTasks">,
): boolean {
  return c.overdueTasks > 0 || c.blockedTasks > 0;
}

/** Most-urgent first: most overdue, then most blocked, then least-progressed, then
 *  name — a stable order so the lists don't shuffle between renders. */
export function compareByUrgency(a: DashboardProjectRow, b: DashboardProjectRow): number {
  if (b.overdueTasks !== a.overdueTasks) return b.overdueTasks - a.overdueTasks;
  if (b.blockedTasks !== a.blockedTasks) return b.blockedTasks - a.blockedTasks;
  if (a.progressPct !== b.progressPct) return a.progressPct - b.progressPct;
  return a.name.localeCompare(b.name);
}

/** Left-join project rows with their (possibly missing) task-count rows, in JS.
 *  Count rows whose project isn't in `projects` are dropped, so the KPI totals
 *  derived from the result can never disagree with the list the user sees. */
export function mergeProjectTaskCounts(
  projects: ProjectSummary[],
  counts: (ProjectTaskCounts & { projectId: string })[],
): DashboardProjectRow[] {
  const byId = new Map(counts.map((c) => [c.projectId, c]));
  return projects.map((p) => {
    const c = byId.get(p.id) ?? ZERO;
    return {
      ...p,
      openTasks: c.openTasks,
      overdueTasks: c.overdueTasks,
      blockedTasks: c.blockedTasks,
    };
  });
}

/** Sum the per-project counts into the engineer's KPI tiles. */
export function sumTaskCounts(rows: ProjectTaskCounts[]): ProjectTaskCounts {
  return rows.reduce<ProjectTaskCounts>(
    (acc, r) => ({
      openTasks: acc.openTasks + r.openTasks,
      overdueTasks: acc.overdueTasks + r.overdueTasks,
      blockedTasks: acc.blockedTasks + r.blockedTasks,
    }),
    { ...ZERO },
  );
}

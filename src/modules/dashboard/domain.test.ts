import { describe, expect, it } from "vitest";

import {
  compareByUrgency,
  isProjectAtRisk,
  mergeProjectTaskCounts,
  sumTaskCounts,
  type DashboardProjectRow,
  type ProjectSummary,
} from "./domain";

const project = (id: string, over: Partial<DashboardProjectRow> = {}): DashboardProjectRow => ({
  id,
  refCode: `PRJ-${id}`,
  name: id,
  status: "ACTIVE",
  progressPct: 0,
  openTasks: 0,
  overdueTasks: 0,
  blockedTasks: 0,
  ...over,
});

describe("isProjectAtRisk", () => {
  it("flags overdue work", () => {
    expect(isProjectAtRisk({ overdueTasks: 1, blockedTasks: 0 })).toBe(true);
  });
  it("flags blocked work", () => {
    expect(isProjectAtRisk({ overdueTasks: 0, blockedTasks: 2 })).toBe(true);
  });
  it("is calm when nothing is overdue or blocked", () => {
    expect(isProjectAtRisk({ overdueTasks: 0, blockedTasks: 0 })).toBe(false);
  });
});

describe("compareByUrgency", () => {
  it("orders by overdue, then blocked, then least progress, then name", () => {
    const rows = [
      project("calm", { progressPct: 80 }),
      project("blocked", { blockedTasks: 1 }),
      project("overdue-2", { overdueTasks: 2 }),
      project("overdue-1", { overdueTasks: 1 }),
    ];
    expect(
      rows
        .slice()
        .sort(compareByUrgency)
        .map((r) => r.id),
    ).toEqual(["overdue-2", "overdue-1", "blocked", "calm"]);
  });

  it("breaks an overdue/blocked tie by lower progress, then name", () => {
    const rows = [
      project("b", { overdueTasks: 1, progressPct: 50 }),
      project("a", { overdueTasks: 1, progressPct: 50 }),
      project("c", { overdueTasks: 1, progressPct: 10 }),
    ];
    expect(
      rows
        .slice()
        .sort(compareByUrgency)
        .map((r) => r.id),
    ).toEqual(["c", "a", "b"]);
  });
});

describe("mergeProjectTaskCounts", () => {
  const projects: ProjectSummary[] = [
    { id: "p1", refCode: "PRJ-1", name: "One", status: "ACTIVE", progressPct: 20 },
    { id: "p2", refCode: "PRJ-2", name: "Two", status: "PLANNING", progressPct: 0 },
  ];

  it("zero-fills projects with no matching counts", () => {
    const merged = mergeProjectTaskCounts(projects, []);
    expect(merged.map((m) => m.openTasks)).toEqual([0, 0]);
  });

  it("attaches counts by project id", () => {
    const merged = mergeProjectTaskCounts(projects, [
      { projectId: "p1", openTasks: 3, overdueTasks: 1, blockedTasks: 0 },
    ]);
    expect(merged[0]).toMatchObject({ id: "p1", openTasks: 3, overdueTasks: 1 });
    expect(merged[1].openTasks).toBe(0);
  });

  it("drops counts for projects the viewer can't see", () => {
    const merged = mergeProjectTaskCounts(projects, [
      { projectId: "ghost", openTasks: 9, overdueTasks: 9, blockedTasks: 9 },
    ]);
    expect(merged).toHaveLength(2);
    expect(sumTaskCounts(merged).openTasks).toBe(0);
  });
});

describe("sumTaskCounts", () => {
  it("adds each field across rows", () => {
    expect(
      sumTaskCounts([
        { openTasks: 2, overdueTasks: 1, blockedTasks: 0 },
        { openTasks: 3, overdueTasks: 0, blockedTasks: 2 },
      ]),
    ).toEqual({ openTasks: 5, overdueTasks: 1, blockedTasks: 2 });
  });

  it("returns zeros for an empty list", () => {
    expect(sumTaskCounts([])).toEqual({ openTasks: 0, overdueTasks: 0, blockedTasks: 0 });
  });
});

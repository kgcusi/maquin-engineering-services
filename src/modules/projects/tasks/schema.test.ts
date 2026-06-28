import { describe, expect, it } from "vitest";

import {
  bulkUpdateTasksSchema,
  createPhaseSchema,
  createTaskSchema,
  updateTaskStatusSchema,
} from "./schema";

const UUID = "22222222-2222-4222-8222-222222222222";

describe("createTaskSchema", () => {
  it("requires a phase id and coerces progress to a number", () => {
    const parsed = createTaskSchema.parse({ phaseId: UUID, name: "Pour slab", progressPct: "50" });
    expect(parsed.progressPct).toBe(50);
    expect(createTaskSchema.safeParse({ name: "x" }).success).toBe(false);
  });

  it("rejects progress outside 0–100", () => {
    expect(createTaskSchema.safeParse({ phaseId: UUID, name: "x", progressPct: 150 }).success).toBe(
      false,
    );
  });

  it("requires a reason when a task is blocked", () => {
    expect(createTaskSchema.safeParse({ phaseId: UUID, name: "x", isBlocked: true }).success).toBe(
      false,
    );
    expect(
      createTaskSchema.safeParse({
        phaseId: UUID,
        name: "x",
        isBlocked: true,
        blockedReason: "no power",
      }).success,
    ).toBe(true);
  });
});

describe("task date ordering (soft refine)", () => {
  const base = { phaseId: UUID, name: "Pour slab" };

  it("passes when date pairs are blank or one-sided", () => {
    expect(createTaskSchema.safeParse(base).success).toBe(true);
    expect(createTaskSchema.safeParse({ ...base, targetStartDate: "2026-06-01" }).success).toBe(
      true,
    );
  });

  it("accepts an end equal to its start", () => {
    expect(
      createTaskSchema.safeParse({
        ...base,
        targetStartDate: "2026-06-01",
        targetEndDate: "2026-06-01",
      }).success,
    ).toBe(true);
  });

  it("rejects a target end before target start (issue on targetEndDate)", () => {
    const res = createTaskSchema.safeParse({
      ...base,
      targetStartDate: "2026-06-10",
      targetEndDate: "2026-06-01",
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.path[0] === "targetEndDate")).toBe(true);
    }
  });

  it("rejects an actual end before actual start (issue on actualEndDate)", () => {
    const res = createTaskSchema.safeParse({
      ...base,
      actualStartDate: "2026-06-10",
      actualEndDate: "2026-06-01",
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.path[0] === "actualEndDate")).toBe(true);
    }
  });
});

describe("createPhaseSchema date ordering", () => {
  const base = { projectId: UUID, name: "Foundation" };

  it("rejects a target end before target start", () => {
    expect(
      createPhaseSchema.safeParse({
        ...base,
        targetStartDate: "2026-06-10",
        targetEndDate: "2026-06-01",
      }).success,
    ).toBe(false);
  });

  it("passes with a valid window and manual actuals", () => {
    expect(
      createPhaseSchema.safeParse({
        ...base,
        targetStartDate: "2026-06-01",
        targetEndDate: "2026-06-30",
        actualStartDate: "2026-06-02",
        actualEndDate: "2026-06-28",
      }).success,
    ).toBe(true);
  });
});

describe("bulkUpdateTasksSchema target dates", () => {
  const row = (extra: Record<string, unknown>) => ({
    phaseId: UUID,
    rows: [{ name: "Pour slab", ...extra }],
  });

  it("accepts a target window on a row", () => {
    const res = bulkUpdateTasksSchema.safeParse(
      row({ targetStartDate: "2026-06-01", targetEndDate: "2026-06-09" }),
    );
    expect(res.success).toBe(true);
  });

  it("passes when target dates are blank or one-sided", () => {
    expect(bulkUpdateTasksSchema.safeParse(row({})).success).toBe(true);
    expect(bulkUpdateTasksSchema.safeParse(row({ targetStartDate: "2026-06-01" })).success).toBe(
      true,
    );
  });

  it("rejects a target end before target start", () => {
    expect(
      bulkUpdateTasksSchema.safeParse(
        row({ targetStartDate: "2026-06-10", targetEndDate: "2026-06-01" }),
      ).success,
    ).toBe(false);
  });
});

describe("updateTaskStatusSchema", () => {
  it("accepts an actual date on transition", () => {
    expect(
      updateTaskStatusSchema.safeParse({ id: UUID, status: "DONE", actualEndDate: "2026-06-15" })
        .success,
    ).toBe(true);
  });

  it("still requires a reason when blocking", () => {
    expect(updateTaskStatusSchema.safeParse({ id: UUID, status: "BLOCKED" }).success).toBe(false);
  });
});

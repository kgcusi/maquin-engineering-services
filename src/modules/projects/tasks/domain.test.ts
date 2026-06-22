import { describe, expect, it } from "vitest";

import { blockedReasonOk, isTaskDelayed, round2, shouldClearDelayed } from "./domain";

const TODAY = "2026-06-22";

describe("round2", () => {
  it("rounds to two decimals", () => {
    expect(round2(33.333333)).toBe(33.33);
    expect(round2(66.666666)).toBe(66.67);
    expect(round2(100)).toBe(100);
  });
});

describe("isTaskDelayed (display derivation)", () => {
  it("is true when the stored flag is set, regardless of dates", () => {
    expect(isTaskDelayed(40, null, true, TODAY)).toBe(true);
  });

  it("derives true for an open task past its due date", () => {
    expect(isTaskDelayed(40, "2026-06-21", false, TODAY)).toBe(true);
  });

  it("is false when complete, undated, or due today/later", () => {
    expect(isTaskDelayed(100, "2026-06-21", false, TODAY)).toBe(false);
    expect(isTaskDelayed(40, null, false, TODAY)).toBe(false);
    expect(isTaskDelayed(40, "2026-06-22", false, TODAY)).toBe(false);
    expect(isTaskDelayed(40, "2026-06-30", false, TODAY)).toBe(false);
  });
});

describe("shouldClearDelayed (write-path reset)", () => {
  it("clears when complete, undated, or due today/later", () => {
    expect(shouldClearDelayed(100, "2026-06-21", TODAY)).toBe(true);
    expect(shouldClearDelayed(40, null, TODAY)).toBe(true);
    expect(shouldClearDelayed(40, "2026-06-22", TODAY)).toBe(true);
  });

  it("keeps the flag for a still-open, still-past-due task", () => {
    expect(shouldClearDelayed(40, "2026-06-21", TODAY)).toBe(false);
  });
});

describe("blockedReasonOk", () => {
  it("requires a reason only when blocked", () => {
    expect(blockedReasonOk({ isBlocked: false })).toBe(true);
    expect(blockedReasonOk({ isBlocked: true, blockedReason: "waiting on rebar" })).toBe(true);
    expect(blockedReasonOk({ isBlocked: true, blockedReason: "" })).toBe(false);
    expect(blockedReasonOk({ isBlocked: true })).toBe(false);
  });
});

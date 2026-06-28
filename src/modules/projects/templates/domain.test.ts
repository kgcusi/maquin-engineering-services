import { describe, expect, it } from "vitest";

import {
  addCalendarDays,
  chainPhaseSchedule,
  isPhaseOverAllocated,
  phaseWeightTotal,
} from "./domain";

describe("addCalendarDays", () => {
  it("adds calendar days within a month", () => {
    expect(addCalendarDays("2026-07-01", 6)).toBe("2026-07-07");
  });

  it("rolls over a month boundary", () => {
    expect(addCalendarDays("2026-07-28", 4)).toBe("2026-08-01");
  });

  it("crosses a leap-year February correctly", () => {
    expect(addCalendarDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addCalendarDays("2028-02-28", 2)).toBe("2028-03-01");
  });

  it("supports a zero offset (same day) and is DST-stable (UTC math)", () => {
    expect(addCalendarDays("2026-03-08", 0)).toBe("2026-03-08");
    expect(addCalendarDays("2026-03-08", 1)).toBe("2026-03-09");
  });

  it("rejects a malformed date", () => {
    expect(() => addCalendarDays("2026/07/01", 1)).toThrow();
  });
});

describe("chainPhaseSchedule", () => {
  it("lays phases back-to-back, inclusive ends (the docs example)", () => {
    expect(chainPhaseSchedule("2026-07-01", [7, 21, 45])).toEqual([
      { targetStartDate: "2026-07-01", targetEndDate: "2026-07-07" },
      { targetStartDate: "2026-07-08", targetEndDate: "2026-07-28" },
      { targetStartDate: "2026-07-29", targetEndDate: "2026-09-11" },
    ]);
  });

  it("honors an adjusted duration (7 → 9) for the first phase", () => {
    const [first, second] = chainPhaseSchedule("2026-07-01", [9, 21]);
    expect(first).toEqual({ targetStartDate: "2026-07-01", targetEndDate: "2026-07-09" });
    expect(second.targetStartDate).toBe("2026-07-10");
  });

  it("clamps a sub-1 duration to a single day so phases never collapse", () => {
    expect(chainPhaseSchedule("2026-07-01", [0, 3])).toEqual([
      { targetStartDate: "2026-07-01", targetEndDate: "2026-07-01" },
      { targetStartDate: "2026-07-02", targetEndDate: "2026-07-04" },
    ]);
  });

  it("returns an empty schedule for no phases", () => {
    expect(chainPhaseSchedule("2026-07-01", [])).toEqual([]);
  });
});

describe("phaseWeightTotal", () => {
  it("sums weights and rounds to 2 decimals", () => {
    expect(phaseWeightTotal([40, 30, 20])).toBe(90);
    expect(phaseWeightTotal([33.33, 33.33, 33.34])).toBe(100);
  });

  it("treats an empty phase as 0", () => {
    expect(phaseWeightTotal([])).toBe(0);
  });

  it("ignores non-finite entries", () => {
    expect(phaseWeightTotal([50, Number.NaN, 10])).toBe(60);
  });
});

describe("isPhaseOverAllocated", () => {
  it("is false under and exactly at 100", () => {
    expect(isPhaseOverAllocated(80)).toBe(false);
    expect(isPhaseOverAllocated(100)).toBe(false);
  });

  it("tolerates float dust just over 100", () => {
    expect(isPhaseOverAllocated(100.0005)).toBe(false);
  });

  it("is true once meaningfully over 100", () => {
    expect(isPhaseOverAllocated(100.5)).toBe(true);
    expect(isPhaseOverAllocated(130)).toBe(true);
  });
});

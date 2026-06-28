import { describe, expect, it } from "vitest";

import { barState, datePos, expectedProgressPct, scheduleVariance, spanBounds } from "./schedule";

describe("expectedProgressPct", () => {
  it("is 0 before the start", () => {
    expect(expectedProgressPct("2026-01-01", "2026-01-31", "2025-12-15")).toBe(0);
    expect(expectedProgressPct("2026-01-01", "2026-01-31", "2026-01-01")).toBe(0);
  });

  it("is 100 on/after the end", () => {
    expect(expectedProgressPct("2026-01-01", "2026-01-31", "2026-01-31")).toBe(100);
    expect(expectedProgressPct("2026-01-01", "2026-01-31", "2026-03-01")).toBe(100);
  });

  it("interpolates linearly in the window", () => {
    // 10-day window, day 5 → ~50%.
    expect(expectedProgressPct("2026-01-01", "2026-01-11", "2026-01-06")).toBeCloseTo(50, 5);
  });

  it("returns null when a bound is missing", () => {
    expect(expectedProgressPct(null, "2026-01-31", "2026-01-06")).toBeNull();
    expect(expectedProgressPct("2026-01-01", null, "2026-01-06")).toBeNull();
  });

  it("handles a degenerate (same-day) window", () => {
    expect(expectedProgressPct("2026-01-10", "2026-01-10", "2026-01-10")).toBe(100);
    expect(expectedProgressPct("2026-01-10", "2026-01-10", "2026-01-09")).toBe(0);
  });
});

describe("scheduleVariance", () => {
  it("flags ahead when actual leads expected", () => {
    expect(scheduleVariance(70, 55)).toEqual({ delta: 15, state: "ahead" });
  });

  it("flags behind when actual lags expected", () => {
    expect(scheduleVariance(40, 60)).toEqual({ delta: -20, state: "behind" });
  });

  it("treats small gaps as on_track", () => {
    expect(scheduleVariance(51, 50).state).toBe("on_track");
    expect(scheduleVariance(49, 50).state).toBe("on_track");
  });

  it("is on_track with no expected baseline", () => {
    expect(scheduleVariance(80, null)).toEqual({ delta: 0, state: "on_track" });
  });
});

describe("barState", () => {
  const today = "2026-06-23";

  it("is done at 100% regardless of dates", () => {
    expect(barState(100, "2026-01-01", 100, today)).toBe("done");
  });

  it("is overdue when open past the target end", () => {
    expect(barState(60, "2026-06-01", 100, today)).toBe("overdue");
  });

  it("is behind when lagging the plan but not yet past due", () => {
    expect(barState(30, "2026-12-31", 60, today)).toBe("behind");
  });

  it("is on_track when keeping pace", () => {
    expect(barState(60, "2026-12-31", 55, today)).toBe("on_track");
  });
});

describe("spanBounds", () => {
  it("returns the min/max across valid dates, ignoring nulls", () => {
    const b = spanBounds(["2026-03-01", null, "2026-01-15", undefined, "2026-05-20"]);
    expect(b).not.toBeNull();
    expect(b!.min).toBe(new Date("2026-01-15T00:00:00").getTime());
    expect(b!.max).toBe(new Date("2026-05-20T00:00:00").getTime());
  });

  it("returns null when no dates are valid", () => {
    expect(spanBounds([null, undefined])).toBeNull();
  });
});

describe("datePos", () => {
  const min = new Date("2026-01-01T00:00:00").getTime();
  const max = new Date("2026-01-11T00:00:00").getTime();

  it("maps the midpoint to ~50%", () => {
    expect(datePos("2026-01-06", min, max)).toBeCloseTo(50, 5);
  });

  it("clamps outside the range", () => {
    expect(datePos("2025-12-01", min, max)).toBe(0);
    expect(datePos("2026-02-01", min, max)).toBe(100);
  });

  it("returns null for an undated value", () => {
    expect(datePos(null, min, max)).toBeNull();
  });
});

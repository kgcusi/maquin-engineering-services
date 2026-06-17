import { describe, expect, it } from "vitest";

import {
  PROGRESS_STATUSES,
  PROGRESS_STATUS_LABELS,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  deriveProgressStatus,
  isInWarranty,
  progressStatusLabel,
  projectStatusLabel,
} from "@/lib/statuses";

describe("deriveProgressStatus", () => {
  it("maps the boundaries", () => {
    expect(deriveProgressStatus(0)).toBe("NOT_STARTED");
    expect(deriveProgressStatus(1)).toBe("IN_PROGRESS");
    expect(deriveProgressStatus(50)).toBe("IN_PROGRESS");
    expect(deriveProgressStatus(99)).toBe("IN_PROGRESS");
    expect(deriveProgressStatus(100)).toBe("DONE");
  });

  it("clamps out-of-range values to the nearest terminal state", () => {
    expect(deriveProgressStatus(-5)).toBe("NOT_STARTED");
    expect(deriveProgressStatus(150)).toBe("DONE");
  });
});

describe("isInWarranty", () => {
  const until = new Date("2026-12-31T00:00:00Z");

  it("is true only when Completed and on/before the defects-liability date", () => {
    expect(isInWarranty("COMPLETED", until, new Date("2026-06-16T00:00:00Z"))).toBe(true);
    // boundary: as-of === until counts as still in warranty
    expect(isInWarranty("COMPLETED", until, until)).toBe(true);
  });

  it("is false past the date, for other statuses, or with no date", () => {
    expect(isInWarranty("COMPLETED", until, new Date("2027-01-01T00:00:00Z"))).toBe(false);
    expect(isInWarranty("ACTIVE", until, new Date("2026-06-16T00:00:00Z"))).toBe(false);
    expect(isInWarranty("COMPLETED", null, new Date("2026-06-16T00:00:00Z"))).toBe(false);
  });
});

describe("status label maps", () => {
  it("cover every code and fall back gracefully", () => {
    for (const s of PROJECT_STATUSES) expect(PROJECT_STATUS_LABELS[s]).toBeTruthy();
    for (const s of PROGRESS_STATUSES) expect(PROGRESS_STATUS_LABELS[s]).toBeTruthy();
    expect(projectStatusLabel("ACTIVE")).toBe("Active");
    expect(projectStatusLabel(null)).toBe("—");
    expect(projectStatusLabel("UNKNOWN")).toBe("UNKNOWN");
    expect(progressStatusLabel("DONE")).toBe("Done");
  });
});

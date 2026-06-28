import { describe, expect, it } from "vitest";

import { inspectionStatusLabel } from "@/lib/statuses";

import { canReinspect, isInspectionOpen } from "./domain";

describe("isInspectionOpen", () => {
  it("is open (withdrawable) only while REQUESTED", () => {
    expect(isInspectionOpen("REQUESTED")).toBe(true);
    expect(isInspectionOpen("PASSED")).toBe(false);
    expect(isInspectionOpen("FAILED")).toBe(false);
  });
});

describe("canReinspect", () => {
  it("allows re-inspection in place once an outcome is recorded", () => {
    expect(canReinspect("FAILED")).toBe(true);
    expect(canReinspect("PASSED")).toBe(true);
  });

  it("is not re-inspection while still awaiting the first outcome", () => {
    expect(canReinspect("REQUESTED")).toBe(false);
  });
});

describe("inspectionStatusLabel", () => {
  it("labels the known statuses and falls back", () => {
    expect(inspectionStatusLabel("REQUESTED")).toBe("Requested");
    expect(inspectionStatusLabel("PASSED")).toBe("Passed");
    expect(inspectionStatusLabel("FAILED")).toBe("Failed");
    expect(inspectionStatusLabel(null)).toBe("—");
    expect(inspectionStatusLabel("WEIRD")).toBe("WEIRD");
  });
});

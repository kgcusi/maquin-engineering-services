import { describe, expect, it } from "vitest";

import { formatDateTime } from "@/lib/datetime";

// 8:00 PM UTC on Jun 16 is 4:00 AM Jun 17 in Manila (UTC+8) — the calendar day
// differs between the zones, which lets us assert the timezone is actually applied
// without depending on the runtime locale's formatting.
const INSTANT = new Date("2026-06-16T20:00:00.000Z");

describe("formatDateTime", () => {
  it("applies the given timezone (UTC vs Asia/Manila differ)", () => {
    expect(formatDateTime(INSTANT, "UTC", "datetime")).not.toBe(
      formatDateTime(INSTANT, "Asia/Manila", "datetime"),
    );
  });

  it("rolls the calendar day across midnight by zone", () => {
    expect(formatDateTime(INSTANT, "UTC", "date")).toContain("16");
    expect(formatDateTime(INSTANT, "Asia/Manila", "date")).toContain("17");
  });

  it("accepts a Date or an ISO string equivalently", () => {
    expect(formatDateTime(INSTANT.toISOString(), "UTC", "date")).toBe(
      formatDateTime(INSTANT, "UTC", "date"),
    );
  });

  it("date style omits the time; datetime includes it", () => {
    expect(formatDateTime(INSTANT, "UTC", "datetime").length).toBeGreaterThan(
      formatDateTime(INSTANT, "UTC", "date").length,
    );
  });
});

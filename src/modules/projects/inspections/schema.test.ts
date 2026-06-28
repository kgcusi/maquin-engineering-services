import { describe, expect, it } from "vitest";

import { recordInspectionSchema, requestInspectionSchema } from "./schema";

const UUID = "00000000-0000-0000-0000-000000000000";

describe("requestInspectionSchema", () => {
  it("accepts a titled request with an inspector", () => {
    const r = requestInspectionSchema.safeParse({
      projectId: UUID,
      title: "Slab rebar",
      inspectorId: UUID,
    });
    expect(r.success).toBe(true);
  });

  it("requires a title and a valid inspector id", () => {
    expect(
      requestInspectionSchema.safeParse({ projectId: UUID, title: "", inspectorId: UUID }).success,
    ).toBe(false);
    expect(
      requestInspectionSchema.safeParse({ projectId: UUID, title: "X", inspectorId: "nope" })
        .success,
    ).toBe(false);
  });

  it("rejects a malformed scheduled date but accepts blank", () => {
    expect(
      requestInspectionSchema.safeParse({
        projectId: UUID,
        title: "X",
        inspectorId: UUID,
        scheduledFor: "06/23/2026",
      }).success,
    ).toBe(false);
    expect(
      requestInspectionSchema.safeParse({
        projectId: UUID,
        title: "X",
        inspectorId: UUID,
        scheduledFor: "",
      }).success,
    ).toBe(true);
  });
});

describe("recordInspectionSchema", () => {
  it("accepts a pass without remarks", () => {
    expect(recordInspectionSchema.safeParse({ id: UUID, outcome: "PASSED" }).success).toBe(true);
  });

  it("requires remarks on a fail", () => {
    expect(recordInspectionSchema.safeParse({ id: UUID, outcome: "FAILED" }).success).toBe(false);
    expect(
      recordInspectionSchema.safeParse({ id: UUID, outcome: "FAILED", remarks: "Honeycombing" })
        .success,
    ).toBe(true);
  });

  it("rejects an unknown outcome", () => {
    expect(recordInspectionSchema.safeParse({ id: UUID, outcome: "MAYBE" }).success).toBe(false);
  });

  it("defaults items to an empty list (free-form, no checklist)", () => {
    const r = recordInspectionSchema.safeParse({ id: UUID, outcome: "PASSED" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.items).toEqual([]);
  });

  it("accepts checklist items with per-item results and photo ids", () => {
    const r = recordInspectionSchema.safeParse({
      id: UUID,
      outcome: "FAILED",
      remarks: "Cover too thin",
      checklistId: UUID,
      items: [
        { label: "Rebar spacing", result: "PASS" },
        { label: "Concrete cover", result: "FAIL", remarks: "25mm", fileIds: [UUID] },
        { label: "Slump test", result: "NA" },
      ],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.items).toHaveLength(3);
  });

  it("rejects an unknown per-item result", () => {
    expect(
      recordInspectionSchema.safeParse({
        id: UUID,
        outcome: "PASSED",
        items: [{ label: "X", result: "MAYBE" }],
      }).success,
    ).toBe(false);
  });

  it("treats an empty checklistId as free-form (allowed)", () => {
    expect(
      recordInspectionSchema.safeParse({ id: UUID, outcome: "PASSED", checklistId: "" }).success,
    ).toBe(true);
  });
});

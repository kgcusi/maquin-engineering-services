import { describe, expect, it } from "vitest";

import { hasHighSeverityIssue } from "./domain";
import { saveDsrDraftSchema } from "./schema";

const UUID = "33333333-3333-4333-8333-333333333333";

describe("saveDsrDraftSchema", () => {
  it("defaults the child arrays and coerces quantities", () => {
    const parsed = saveDsrDraftSchema.parse({ id: UUID });
    expect(parsed.manpower).toEqual([]);
    expect(parsed.materials).toEqual([]);
    const withMat = saveDsrDraftSchema.parse({
      id: UUID,
      materials: [{ description: "Cement", quantity: "3.5", unitCode: "bag" }],
    });
    expect(withMat.materials[0].quantity).toBe(3.5);
  });

  it("requires a material to carry a description (no item link yet)", () => {
    const bad = saveDsrDraftSchema.safeParse({
      id: UUID,
      materials: [{ quantity: 2, unitCode: "bag" }],
    });
    expect(bad.success).toBe(false);
  });

  it("rejects an unknown trade or unit code", () => {
    expect(
      saveDsrDraftSchema.safeParse({ id: UUID, manpower: [{ tradeCode: "WIZARD", headcount: 2 }] })
        .success,
    ).toBe(false);
  });
});

describe("hasHighSeverityIssue", () => {
  it("flags only when a HIGH-severity issue is present", () => {
    expect(hasHighSeverityIssue([])).toBe(false);
    expect(hasHighSeverityIssue([{ severity: "LOW" }, { severity: "MEDIUM" }])).toBe(false);
    expect(hasHighSeverityIssue([{ severity: "MEDIUM" }, { severity: "HIGH" }])).toBe(true);
  });
});

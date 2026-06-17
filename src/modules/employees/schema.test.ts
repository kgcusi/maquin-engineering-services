import { describe, expect, it } from "vitest";

import { confirmEmployeeDocumentSchema, createEmployeeSchema } from "./schema";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("employee schema", () => {
  it("requires a full name and a rate basis", () => {
    expect(createEmployeeSchema.safeParse({ fullName: "", rateUnit: "DAILY" }).success).toBe(false);
    expect(
      createEmployeeSchema.safeParse({ fullName: "Juan Cruz", rateUnit: "DAILY" }).success,
    ).toBe(true);
    // rateUnit is required
    expect(createEmployeeSchema.safeParse({ fullName: "Juan Cruz" }).success).toBe(false);
  });

  it("validates employment type, email, and rate when present; allows empty", () => {
    const base = { fullName: "J", rateUnit: "MONTHLY" as const };
    expect(createEmployeeSchema.safeParse({ ...base, employmentType: "" }).success).toBe(true);
    expect(createEmployeeSchema.safeParse({ ...base, employmentType: "REGULAR" }).success).toBe(
      true,
    );
    expect(createEmployeeSchema.safeParse({ ...base, employmentType: "ALIEN" }).success).toBe(
      false,
    );
    expect(createEmployeeSchema.safeParse({ ...base, rate: "550.00" }).success).toBe(true);
    expect(createEmployeeSchema.safeParse({ ...base, rate: "abc" }).success).toBe(false);
    expect(createEmployeeSchema.safeParse({ ...base, email: "nope" }).success).toBe(false);
  });

  it("rejects an unknown rate basis", () => {
    expect(createEmployeeSchema.safeParse({ fullName: "J", rateUnit: "YEARLY" }).success).toBe(
      false,
    );
  });

  it("document confirm requires uuids + a known document type", () => {
    const base = { employeeId: UUID, fileId: UUID, kind: "Contract" };
    expect(confirmEmployeeDocumentSchema.safeParse(base).success).toBe(true);
    expect(confirmEmployeeDocumentSchema.safeParse({ ...base, kind: "Random" }).success).toBe(
      false,
    );
  });
});

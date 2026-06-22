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

  it("normalizes a provided email to trimmed lowercase", () => {
    const parsed = createEmployeeSchema.parse({
      fullName: "J",
      rateUnit: "DAILY",
      email: "Juan.Cruz@Example.com ",
    });
    expect(parsed.email).toBe("juan.cruz@example.com");
  });

  it("rejects an unknown rate basis", () => {
    expect(createEmployeeSchema.safeParse({ fullName: "J", rateUnit: "YEARLY" }).success).toBe(
      false,
    );
  });

  it("defaults isActive to true and accepts an explicit boolean", () => {
    const base = { fullName: "J", rateUnit: "DAILY" as const };
    expect(createEmployeeSchema.parse(base).isActive).toBe(true);
    expect(createEmployeeSchema.parse({ ...base, isActive: false }).isActive).toBe(false);
    expect(createEmployeeSchema.safeParse({ ...base, isActive: "yes" }).success).toBe(false);
  });

  it("document confirm requires uuids and accepts an optional name", () => {
    const base = { employeeId: UUID, fileId: UUID };
    expect(confirmEmployeeDocumentSchema.safeParse(base).success).toBe(true);
    expect(
      confirmEmployeeDocumentSchema.safeParse({ ...base, name: "Signed contract" }).success,
    ).toBe(true);
    expect(
      confirmEmployeeDocumentSchema.safeParse({ ...base, name: "x".repeat(121) }).success,
    ).toBe(false);
    expect(confirmEmployeeDocumentSchema.safeParse({ employeeId: UUID }).success).toBe(false);
  });
});

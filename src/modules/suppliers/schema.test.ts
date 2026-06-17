import { describe, expect, it } from "vitest";

import { createSupplierSchema, updateSupplierSchema } from "./schema";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("supplier schema", () => {
  it("requires a name", () => {
    expect(createSupplierSchema.safeParse({ name: "" }).success).toBe(false);
    expect(createSupplierSchema.safeParse({ name: "Acme Supply" }).success).toBe(true);
  });

  it("accepts empty optional fields and validates email when present", () => {
    expect(createSupplierSchema.safeParse({ name: "Acme", email: "" }).success).toBe(true);
    expect(createSupplierSchema.safeParse({ name: "Acme", email: "sales@acme.com" }).success).toBe(
      true,
    );
    expect(createSupplierSchema.safeParse({ name: "Acme", email: "nope" }).success).toBe(false);
  });

  it("update requires a uuid id", () => {
    expect(updateSupplierSchema.safeParse({ name: "Acme", id: "not-a-uuid" }).success).toBe(false);
    expect(updateSupplierSchema.safeParse({ name: "Acme", id: UUID }).success).toBe(true);
  });
});

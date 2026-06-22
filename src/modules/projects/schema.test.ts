import { describe, expect, it } from "vitest";

import { changeProjectStatusSchema, createProjectSchema } from "./schema";

const UUID = "11111111-1111-4111-8111-111111111111";

describe("createProjectSchema", () => {
  it("accepts a Better Auth (non-uuid) lead id and defaults memberIds", () => {
    const parsed = createProjectSchema.parse({
      name: "Tower B",
      clientId: UUID,
      leadEngineerId: "abc123XYZ", // Better Auth ids are text, NOT uuids
    });
    expect(parsed.leadEngineerId).toBe("abc123XYZ");
    expect(parsed.memberIds).toEqual([]);
  });

  it("requires a uuid client id", () => {
    expect(createProjectSchema.safeParse({ name: "X", clientId: "not-a-uuid" }).success).toBe(
      false,
    );
    expect(createProjectSchema.safeParse({ name: "X" }).success).toBe(false);
  });

  it("rejects a blank name", () => {
    expect(createProjectSchema.safeParse({ name: "", clientId: UUID }).success).toBe(false);
  });
});

describe("changeProjectStatusSchema", () => {
  it("accepts a known status, rejects an unknown one", () => {
    expect(changeProjectStatusSchema.safeParse({ id: UUID, status: "ACTIVE" }).success).toBe(true);
    expect(changeProjectStatusSchema.safeParse({ id: UUID, status: "PAUSED" }).success).toBe(false);
  });
});

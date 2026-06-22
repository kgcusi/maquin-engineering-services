import { describe, expect, it } from "vitest";

import { createTaskSchema } from "./schema";

const UUID = "22222222-2222-4222-8222-222222222222";

describe("createTaskSchema", () => {
  it("requires a phase id and coerces progress to a number", () => {
    const parsed = createTaskSchema.parse({ phaseId: UUID, name: "Pour slab", progressPct: "50" });
    expect(parsed.progressPct).toBe(50);
    expect(createTaskSchema.safeParse({ name: "x" }).success).toBe(false);
  });

  it("rejects progress outside 0–100", () => {
    expect(createTaskSchema.safeParse({ phaseId: UUID, name: "x", progressPct: 150 }).success).toBe(
      false,
    );
  });

  it("requires a reason when a task is blocked", () => {
    expect(createTaskSchema.safeParse({ phaseId: UUID, name: "x", isBlocked: true }).success).toBe(
      false,
    );
    expect(
      createTaskSchema.safeParse({
        phaseId: UUID,
        name: "x",
        isBlocked: true,
        blockedReason: "no power",
      }).success,
    ).toBe(true);
  });
});

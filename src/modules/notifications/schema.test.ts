import { describe, expect, it } from "vitest";

import { markNotificationReadSchema } from "./schema";

describe("markNotificationReadSchema", () => {
  it("accepts a uuid id", () => {
    const r = markNotificationReadSchema.safeParse({
      id: "00000000-0000-0000-0000-000000000000",
    });
    expect(r.success).toBe(true);
  });

  it("rejects a non-uuid id", () => {
    expect(markNotificationReadSchema.safeParse({ id: "123" }).success).toBe(false);
    expect(markNotificationReadSchema.safeParse({}).success).toBe(false);
  });
});

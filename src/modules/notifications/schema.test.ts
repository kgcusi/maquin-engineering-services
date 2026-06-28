import { describe, expect, it } from "vitest";

import { markNotificationReadSchema, updateNotificationSettingsSchema } from "./schema";

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

describe("updateNotificationSettingsSchema", () => {
  it("accepts a known event with channels", () => {
    const r = updateNotificationSettingsSchema.safeParse({
      events: [{ eventKey: "task.blocked", enabled: true, channels: ["IN_APP", "EMAIL"] }],
    });
    expect(r.success).toBe(true);
  });

  it("accepts a disabled event with no channels", () => {
    const r = updateNotificationSettingsSchema.safeParse({
      events: [{ eventKey: "task.assigned", enabled: false, channels: [] }],
    });
    expect(r.success).toBe(true);
  });

  it("rejects an enabled event with no channels", () => {
    const r = updateNotificationSettingsSchema.safeParse({
      events: [{ eventKey: "task.blocked", enabled: true, channels: [] }],
    });
    expect(r.success).toBe(false);
  });

  it("rejects unknown event keys and channels", () => {
    expect(
      updateNotificationSettingsSchema.safeParse({
        events: [{ eventKey: "not.a.real.event", enabled: true, channels: ["IN_APP"] }],
      }).success,
    ).toBe(false);
    expect(
      updateNotificationSettingsSchema.safeParse({
        events: [{ eventKey: "task.blocked", enabled: true, channels: ["SMS"] }],
      }).success,
    ).toBe(false);
  });
});

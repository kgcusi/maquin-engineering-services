import { describe, expect, it } from "vitest";

import {
  NOTIFICATION_EVENTS,
  NOTIFICATION_EVENT_KEYS,
  TEST_EVENT_KEY,
  humanizeEvent,
} from "./notification-events";

describe("notification event catalog", () => {
  it("has unique keys covering the docs/08 §3 catalog", () => {
    const keys = NOTIFICATION_EVENT_KEYS;
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.length).toBeGreaterThanOrEqual(16);
    for (const key of ["material_request.submitted", "expense.approved", "user.created"]) {
      expect(keys).toContain(key);
    }
  });

  it("every entry is well-formed", () => {
    for (const key of NOTIFICATION_EVENT_KEYS) {
      const def = NOTIFICATION_EVENTS[key];
      expect(def.label.length).toBeGreaterThan(0);
      expect(def.defaultChannels.length).toBeGreaterThan(0);
      expect(["IMMEDIATE", "DIGEST"]).toContain(def.defaultMode);
    }
  });

  it("the test event is not part of the auto-emitted catalog", () => {
    expect(NOTIFICATION_EVENT_KEYS).not.toContain(TEST_EVENT_KEY);
  });
});

describe("humanizeEvent", () => {
  it("returns the catalog label for known keys", () => {
    expect(humanizeEvent("user.created")).toBe(NOTIFICATION_EVENTS["user.created"].label);
  });

  it("title-cases unknown dotted/underscored keys", () => {
    expect(humanizeEvent("notification.test")).toBe("Notification Test");
    expect(humanizeEvent("some.unknown_key")).toBe("Some Unknown Key");
  });
});

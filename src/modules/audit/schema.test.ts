import { describe, expect, it } from "vitest";

import { auditFilterSchema } from "./schema";

describe("auditFilterSchema", () => {
  it("defaults to page 1 with no filters when empty", () => {
    const r = auditFilterSchema.parse({});
    expect(r.page).toBe(1);
    expect(r.actorId).toBeUndefined();
    expect(r.action).toBeUndefined();
    expect(r.entityType).toBeUndefined();
    expect(r.from).toBeUndefined();
    expect(r.to).toBeUndefined();
  });

  it("drops empty / whitespace-only filters", () => {
    const r = auditFilterSchema.parse({ actorId: "", action: "   ", entityType: "", from: "" });
    expect(r.actorId).toBeUndefined();
    expect(r.action).toBeUndefined();
    expect(r.entityType).toBeUndefined();
    expect(r.from).toBeUndefined();
  });

  it("keeps valid filters and coerces the page", () => {
    const r = auditFilterSchema.parse({
      actorId: "u1",
      action: "user.created",
      entityType: "user",
      from: "2026-01-01",
      to: "2026-06-16",
      page: "3",
    });
    expect(r).toMatchObject({
      actorId: "u1",
      action: "user.created",
      entityType: "user",
      from: "2026-01-01",
      to: "2026-06-16",
      page: 3,
    });
  });

  it("rejects malformed dates and out-of-range pages, falling back", () => {
    const r = auditFilterSchema.parse({ from: "06/16/2026", to: "2026-13-45", page: "0" });
    expect(r.from).toBeUndefined();
    expect(r.to).toBeUndefined();
    expect(r.page).toBe(1);
  });

  it("ignores non-string (repeated) params instead of throwing", () => {
    const r = auditFilterSchema.parse({ actorId: ["a", "b"], page: "abc" });
    expect(r.actorId).toBeUndefined();
    expect(r.page).toBe(1);
  });
});

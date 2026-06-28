import { describe, expect, it } from "vitest";

import { createChecklistSchema, updateChecklistSchema } from "./schema";

const UUID = "00000000-0000-0000-0000-000000000000";

describe("createChecklistSchema", () => {
  it("accepts a named checklist with at least one item", () => {
    const r = createChecklistSchema.safeParse({
      name: "Concrete Pour",
      category: "Structural",
      items: [{ label: "Rebar spacing" }, { label: "Concrete cover", guidance: "min 25mm" }],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.isActive).toBe(true); // defaults active
      expect(r.data.items).toHaveLength(2);
    }
  });

  it("requires a name and at least one item", () => {
    expect(createChecklistSchema.safeParse({ name: "", items: [{ label: "X" }] }).success).toBe(
      false,
    );
    expect(createChecklistSchema.safeParse({ name: "Pour", items: [] }).success).toBe(false);
  });

  it("rejects a blank item label", () => {
    expect(createChecklistSchema.safeParse({ name: "Pour", items: [{ label: "" }] }).success).toBe(
      false,
    );
  });

  it("update requires an id", () => {
    expect(updateChecklistSchema.safeParse({ name: "Pour", items: [{ label: "X" }] }).success).toBe(
      false,
    );
    expect(
      updateChecklistSchema.safeParse({ id: UUID, name: "Pour", items: [{ label: "X" }] }).success,
    ).toBe(true);
  });
});

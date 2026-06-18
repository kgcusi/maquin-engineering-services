import { describe, expect, it } from "vitest";

import { diffFields } from "@/lib/audit";

describe("diffFields", () => {
  it("keeps only the fields that actually changed", () => {
    const diff = diffFields(
      { name: "Acme", phone: "111", email: "a@x.com" },
      { name: "Acme Corp", phone: "111", email: "a@x.com" },
    );
    expect(diff).toEqual({ name: { from: "Acme", to: "Acme Corp" } });
  });

  it("returns undefined when nothing changed", () => {
    expect(
      diffFields({ name: "Acme", phone: "111" }, { name: "Acme", phone: "111" }),
    ).toBeUndefined();
  });

  it("treats null, undefined and empty string as the same absence of a value", () => {
    expect(
      diffFields({ phone: null, address: null }, { phone: "", address: undefined }),
    ).toBeUndefined();
  });

  it("records clearing a value (real value → blank)", () => {
    expect(diffFields({ phone: "111" }, { phone: null })).toEqual({
      phone: { from: "111", to: null },
    });
  });

  it("records setting a previously-blank value", () => {
    expect(diffFields({ phone: null }, { phone: "111" })).toEqual({
      phone: { from: null, to: "111" },
    });
  });
});

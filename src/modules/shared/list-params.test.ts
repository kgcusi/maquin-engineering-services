import { describe, expect, it } from "vitest";

import { directoryListSchema, escapeLike, offsetFor, pageParam, searchClause } from "./list-params";

describe("directoryListSchema", () => {
  it("coerces and clamps the page to a positive integer, else page 1", () => {
    expect(directoryListSchema.parse({ page: "3" }).page).toBe(3);
    expect(directoryListSchema.parse({}).page).toBe(1);
    expect(directoryListSchema.parse({ page: "0" }).page).toBe(1);
    expect(directoryListSchema.parse({ page: "-2" }).page).toBe(1);
    expect(directoryListSchema.parse({ page: "2.5" }).page).toBe(1);
    expect(directoryListSchema.parse({ page: "abc" }).page).toBe(1);
  });

  it("trims the query and drops a blank one", () => {
    expect(directoryListSchema.parse({ q: "  acme  " }).q).toBe("acme");
    expect(directoryListSchema.parse({ q: "" }).q).toBeUndefined();
    expect(directoryListSchema.parse({ q: "   " }).q).toBeUndefined();
    expect(directoryListSchema.parse({}).q).toBeUndefined();
    // A repeated key arrives as an array — not a string, so it drops to undefined.
    expect(directoryListSchema.parse({ q: ["a", "b"] }).q).toBeUndefined();
  });
});

describe("pageParam", () => {
  it("parses a namespaced page param with a page-1 fallback", () => {
    expect(pageParam("2")).toBe(2);
    expect(pageParam(undefined)).toBe(1);
    expect(pageParam("nope")).toBe(1);
    expect(pageParam(["2", "3"])).toBe(1);
  });
});

describe("offsetFor", () => {
  it("maps a 1-based page to a zero-based row offset", () => {
    expect(offsetFor(1, 25)).toBe(0);
    expect(offsetFor(2, 25)).toBe(25);
    expect(offsetFor(3, 10)).toBe(20);
  });
});

describe("escapeLike", () => {
  it("escapes LIKE wildcards so user text matches literally", () => {
    expect(escapeLike("50%")).toBe("50\\%");
    expect(escapeLike("a_b")).toBe("a\\_b");
    expect(escapeLike("c:\\dir")).toBe("c:\\\\dir");
    expect(escapeLike("plain")).toBe("plain");
  });
});

describe("searchClause", () => {
  it("returns undefined for an empty query so it composes away in and()", () => {
    expect(searchClause(undefined, [])).toBeUndefined();
    expect(searchClause("", [])).toBeUndefined();
  });
});

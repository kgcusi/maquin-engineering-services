import { describe, expect, it } from "vitest";

import {
  MAX_ATTEMPTS,
  backoffMs,
  buildIdempotencyKey,
  buildNotificationContent,
  parseChannels,
  parseRecipientRule,
} from "./domain";

describe("parseRecipientRule", () => {
  it("parses ROLE rules and upper-cases the role", () => {
    expect(parseRecipientRule("ROLE:ADMIN")).toEqual({ kind: "ROLE", role: "ADMIN" });
    expect(parseRecipientRule("role:admin")).toEqual({ kind: "ROLE", role: "ADMIN" });
  });

  it("parses USER rules keeping the payload field name verbatim", () => {
    expect(parseRecipientRule("USER:requesterId")).toEqual({ kind: "USER", field: "requesterId" });
  });

  it("parses PROJECT rules", () => {
    expect(parseRecipientRule("PROJECT:LEAD_ENGINEER")).toEqual({
      kind: "PROJECT",
      selector: "LEAD_ENGINEER",
    });
  });

  it("returns NONE for null, empty, colon-less, empty-value, or unknown prefixes", () => {
    expect(parseRecipientRule(null)).toEqual({ kind: "NONE" });
    expect(parseRecipientRule("")).toEqual({ kind: "NONE" });
    expect(parseRecipientRule("garbage")).toEqual({ kind: "NONE" });
    expect(parseRecipientRule("USER:")).toEqual({ kind: "NONE" });
    expect(parseRecipientRule("TEAM:sales")).toEqual({ kind: "NONE" });
  });
});

describe("buildIdempotencyKey", () => {
  const base = { eventKey: "expense.approved", scopeId: "e1", recipientId: "u1" } as const;

  it("is deterministic for identical inputs", () => {
    expect(buildIdempotencyKey({ ...base, channel: "EMAIL" })).toBe(
      buildIdempotencyKey({ ...base, channel: "EMAIL" }),
    );
  });

  it("differs by channel, recipient, and scope", () => {
    const email = buildIdempotencyKey({ ...base, channel: "EMAIL" });
    expect(email).not.toBe(buildIdempotencyKey({ ...base, channel: "IN_APP" }));
    expect(email).not.toBe(buildIdempotencyKey({ ...base, recipientId: "u2", channel: "EMAIL" }));
    expect(email).not.toBe(buildIdempotencyKey({ ...base, scopeId: "e2", channel: "EMAIL" }));
  });
});

describe("backoffMs", () => {
  it("ramps 1m → 5m → 30m → 2h and caps at MAX_ATTEMPTS", () => {
    expect(backoffMs(0)).toBe(0);
    expect(backoffMs(1)).toBe(60_000);
    expect(backoffMs(2)).toBe(5 * 60_000);
    expect(backoffMs(3)).toBe(30 * 60_000);
    expect(backoffMs(MAX_ATTEMPTS)).toBe(2 * 60 * 60_000);
    expect(backoffMs(99)).toBe(2 * 60 * 60_000);
  });
});

describe("parseChannels", () => {
  it("normalizes, upper-cases, and de-dupes valid channels", () => {
    expect(parseChannels(["EMAIL", "IN_APP"])).toEqual(["EMAIL", "IN_APP"]);
    expect(parseChannels(["in_app"])).toEqual(["IN_APP"]);
    expect(parseChannels(["EMAIL", "EMAIL"])).toEqual(["EMAIL"]);
  });

  it("drops unknown values and non-arrays", () => {
    expect(parseChannels(["BOGUS"])).toEqual([]);
    expect(parseChannels("EMAIL")).toEqual([]);
    expect(parseChannels(null)).toEqual([]);
  });
});

describe("buildNotificationContent", () => {
  it("uses payload.message / .summary and pulls the entity ref", () => {
    expect(
      buildNotificationContent("Expense approved", {
        message: "Your expense was approved.",
        entityType: "expense",
        entityId: "x1",
      }),
    ).toEqual({
      subject: "Expense approved",
      body: "Your expense was approved.",
      entityType: "expense",
      entityId: "x1",
    });
  });

  it("falls back to the label and null entity when payload is bare", () => {
    expect(buildNotificationContent("Stock low", {})).toEqual({
      subject: "Stock low",
      body: "Stock low.",
      entityType: null,
      entityId: null,
    });
  });
});

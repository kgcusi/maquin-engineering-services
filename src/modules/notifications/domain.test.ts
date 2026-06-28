import { describe, expect, it } from "vitest";

import {
  MAX_ATTEMPTS,
  backoffMs,
  buildIdempotencyKey,
  buildNotificationContent,
  buildNotificationLink,
  channelsEqual,
  describeRecipientRule,
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

describe("channelsEqual", () => {
  it("is order-insensitive and length-aware", () => {
    expect(channelsEqual(["EMAIL", "IN_APP"], ["IN_APP", "EMAIL"])).toBe(true);
    expect(channelsEqual([], [])).toBe(true);
    expect(channelsEqual(["EMAIL"], ["EMAIL", "IN_APP"])).toBe(false);
    expect(channelsEqual(["EMAIL"], ["IN_APP"])).toBe(false);
  });
});

describe("describeRecipientRule", () => {
  it("describes single selectors", () => {
    expect(describeRecipientRule("ROLE:ADMIN")).toBe("Admins");
    expect(describeRecipientRule("USER:assigneeId")).toBe("The assignee");
    expect(describeRecipientRule("PROJECT:LEAD")).toBe("Project lead");
    expect(describeRecipientRule("PROJECT:TEAM")).toBe("Project team");
  });

  it("joins a composite union with a middot", () => {
    expect(describeRecipientRule("ROLE:ADMIN+PROJECT:LEAD")).toBe("Admins · Project lead");
  });

  it("handles no-recipient rules", () => {
    expect(describeRecipientRule(null)).toBe("No automatic recipients");
    expect(describeRecipientRule("")).toBe("No automatic recipients");
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

describe("buildNotificationLink", () => {
  it("points project events at the project (entityId is the project id)", () => {
    expect(
      buildNotificationLink("project.created", { entityType: "project", entityId: "p1" }),
    ).toBe("/projects/p1");
    expect(buildNotificationLink("project.status_changed", { projectId: "p1" })).toBe(
      "/projects/p1",
    );
  });

  it("points task and phase events at the Phases & Tasks tab", () => {
    expect(buildNotificationLink("task.blocked", { projectId: "p1", taskId: "t1" })).toBe(
      "/projects/p1?tab=phases",
    );
    expect(buildNotificationLink("task.assigned", { projectId: "p1" })).toBe(
      "/projects/p1?tab=phases",
    );
    expect(buildNotificationLink("phase.critical_update", { projectId: "p1" })).toBe(
      "/projects/p1?tab=phases",
    );
  });

  it("points inspection events at the Inspections tab", () => {
    expect(
      buildNotificationLink("inspection.requested", {
        projectId: "p1",
        entityType: "inspection",
        entityId: "i1",
      }),
    ).toBe("/projects/p1?tab=inspections");
  });

  it("points DSR events at the specific report, or the reports tab without an id", () => {
    expect(
      buildNotificationLink("dsr.reviewed", {
        projectId: "p1",
        entityType: "daily_report",
        entityId: "d1",
      }),
    ).toBe("/projects/p1/dsr/d1");
    expect(buildNotificationLink("dsr.submitted", { projectId: "p1" })).toBe(
      "/projects/p1?tab=reports",
    );
  });

  it("returns null for non-navigable or under-specified events", () => {
    expect(buildNotificationLink("user.created", { userId: "u1" })).toBeNull();
    expect(buildNotificationLink("auth.login.failed", {})).toBeNull();
    expect(buildNotificationLink("task.blocked", { taskId: "t1" })).toBeNull();
    expect(buildNotificationLink("project.created", {})).toBeNull();
  });
});

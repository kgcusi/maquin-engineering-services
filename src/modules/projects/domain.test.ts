import { describe, expect, it } from "vitest";

import { allowedNextStatuses, canTransitionProject, normalizeTeam } from "./domain";

describe("project status state machine", () => {
  it("allows the legal lifecycle transitions", () => {
    expect(canTransitionProject("PLANNING", "ACTIVE")).toBe(true);
    expect(canTransitionProject("ACTIVE", "ON_HOLD")).toBe(true);
    expect(canTransitionProject("ON_HOLD", "ACTIVE")).toBe(true);
    expect(canTransitionProject("ACTIVE", "COMPLETED")).toBe(true);
  });

  it("allows cancelling from any non-terminal state", () => {
    expect(canTransitionProject("PLANNING", "CANCELLED")).toBe(true);
    expect(canTransitionProject("ACTIVE", "CANCELLED")).toBe(true);
    expect(canTransitionProject("ON_HOLD", "CANCELLED")).toBe(true);
  });

  it("rejects illegal jumps and no-ops", () => {
    expect(canTransitionProject("PLANNING", "COMPLETED")).toBe(false);
    expect(canTransitionProject("ON_HOLD", "COMPLETED")).toBe(false);
    expect(canTransitionProject("ACTIVE", "PLANNING")).toBe(false);
    expect(canTransitionProject("ACTIVE", "ACTIVE")).toBe(false);
  });

  it("treats COMPLETED and CANCELLED as terminal", () => {
    expect(allowedNextStatuses("COMPLETED")).toHaveLength(0);
    expect(allowedNextStatuses("CANCELLED")).toHaveLength(0);
    expect(canTransitionProject("COMPLETED", "ACTIVE")).toBe(false);
    expect(canTransitionProject("CANCELLED", "ACTIVE")).toBe(false);
  });
});

describe("normalizeTeam", () => {
  it("drops the lead from members and de-dupes", () => {
    const { leadId, memberIds } = normalizeTeam("u1", ["u1", "u2", "u2", "u3"]);
    expect(leadId).toBe("u1");
    expect(memberIds).toEqual(["u2", "u3"]);
  });

  it("normalizes an empty lead to null and filters blanks", () => {
    const { leadId, memberIds } = normalizeTeam("", ["", "u2"]);
    expect(leadId).toBeNull();
    expect(memberIds).toEqual(["u2"]);
  });
});

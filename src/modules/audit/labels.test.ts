import { describe, expect, it } from "vitest";

import { actionLabel, entityTypeLabel, humanizeKey } from "./labels";

describe("humanizeKey", () => {
  it("title-cases dotted action keys", () => {
    expect(humanizeKey("user.deactivated")).toBe("User Deactivated");
    expect(humanizeKey("user.created")).toBe("User Created");
  });

  it("splits on underscores and dots together", () => {
    expect(humanizeKey("user.soft_deleted")).toBe("User Soft Deleted");
    expect(humanizeKey("material_request.approved")).toBe("Material Request Approved");
  });

  it("upper-cases known acronyms", () => {
    expect(humanizeKey("dsr.submitted")).toBe("DSR Submitted");
    expect(humanizeKey("mr.created")).toBe("MR Created");
  });

  it("handles a single entity-type token", () => {
    expect(entityTypeLabel("user")).toBe("User");
    expect(actionLabel("expense.paid")).toBe("Expense Paid");
  });
});

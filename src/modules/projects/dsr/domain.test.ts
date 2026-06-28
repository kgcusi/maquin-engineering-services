import { describe, expect, it } from "vitest";

import { canDeleteDsr, canEditDsr, canReopenDsr, canReviewDsr } from "./domain";

const author = { id: "u-author", role: "ENGINEER" };
const otherEngineer = { id: "u-other", role: "ENGINEER" };
const admin = { id: "u-admin", role: "ADMIN" };
const qaqc = { id: "u-qa", role: "QA_QC_ENGINEER" };

const dsr = (status: string, createdBy: string | null = author.id) => ({ status, createdBy });

describe("canEditDsr", () => {
  it("lets the author edit their own DRAFT", () => {
    expect(canEditDsr(author, dsr("DRAFT"))).toBe(true);
  });
  it("lets an admin edit any DRAFT", () => {
    expect(canEditDsr(admin, dsr("DRAFT", otherEngineer.id))).toBe(true);
  });
  it("blocks a different engineer from editing someone else's DRAFT", () => {
    expect(canEditDsr(otherEngineer, dsr("DRAFT"))).toBe(false);
  });
  it("blocks in-place edits once SUBMITTED or APPROVED", () => {
    expect(canEditDsr(author, dsr("SUBMITTED"))).toBe(false);
    expect(canEditDsr(admin, dsr("APPROVED"))).toBe(false);
  });
});

describe("canReviewDsr", () => {
  it("lets an admin review a SUBMITTED report", () => {
    expect(canReviewDsr(admin, dsr("SUBMITTED"))).toBe(true);
  });
  it("blocks the author (engineer) from reviewing", () => {
    expect(canReviewDsr(author, dsr("SUBMITTED"))).toBe(false);
  });
  it("blocks QA/QC from reviewing", () => {
    expect(canReviewDsr(qaqc, dsr("SUBMITTED"))).toBe(false);
  });
  it("only allows review of a SUBMITTED report", () => {
    expect(canReviewDsr(admin, dsr("DRAFT"))).toBe(false);
    expect(canReviewDsr(admin, dsr("APPROVED"))).toBe(false);
  });
});

describe("canReopenDsr", () => {
  it("lets the author reopen their own SUBMITTED report", () => {
    expect(canReopenDsr(author, dsr("SUBMITTED"))).toBe(true);
  });
  it("blocks a different engineer from reopening someone else's SUBMITTED report", () => {
    expect(canReopenDsr(otherEngineer, dsr("SUBMITTED"))).toBe(false);
  });
  it("lets an admin reopen any SUBMITTED or APPROVED report", () => {
    expect(canReopenDsr(admin, dsr("SUBMITTED", otherEngineer.id))).toBe(true);
    expect(canReopenDsr(admin, dsr("APPROVED", otherEngineer.id))).toBe(true);
  });
  it("blocks the author from reopening an APPROVED report (admin only)", () => {
    expect(canReopenDsr(author, dsr("APPROVED"))).toBe(false);
  });
  it("treats a DRAFT as already open", () => {
    expect(canReopenDsr(admin, dsr("DRAFT"))).toBe(false);
    expect(canReopenDsr(author, dsr("DRAFT"))).toBe(false);
  });
});

describe("canDeleteDsr", () => {
  it("lets the author delete their own DRAFT", () => {
    expect(canDeleteDsr(author, dsr("DRAFT"))).toBe(true);
  });
  it("blocks the author from deleting their own SUBMITTED/APPROVED report", () => {
    expect(canDeleteDsr(author, dsr("SUBMITTED"))).toBe(false);
    expect(canDeleteDsr(author, dsr("APPROVED"))).toBe(false);
  });
  it("lets an admin delete any report at any stage", () => {
    expect(canDeleteDsr(admin, dsr("DRAFT", otherEngineer.id))).toBe(true);
    expect(canDeleteDsr(admin, dsr("SUBMITTED", otherEngineer.id))).toBe(true);
    expect(canDeleteDsr(admin, dsr("APPROVED", otherEngineer.id))).toBe(true);
  });
  it("blocks a different engineer from deleting someone else's DRAFT", () => {
    expect(canDeleteDsr(otherEngineer, dsr("DRAFT"))).toBe(false);
  });
  it("never matches a null author as the author", () => {
    expect(canDeleteDsr(author, dsr("DRAFT", null))).toBe(false);
  });
});

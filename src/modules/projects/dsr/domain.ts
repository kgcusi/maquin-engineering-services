import { hasPermission } from "@/lib/permissions";

import type { DsrIssueInput } from "./schema";

// Pure DSR helpers — no server imports (safe for client + unit tests).

/** A HIGH-severity issue raises a `dsr.issue.flagged` notification on submit. */
export function hasHighSeverityIssue(issues: readonly { severity: string }[]): boolean {
  return issues.some((i) => i.severity === "HIGH");
}

// ── Lifecycle policy ──────────────────────────────────────────────────────────
// One place the page, the editor, and the guarded actions all agree on who may do
// what to a report in each state. `role` is the viewer's role string; `createdBy`
// is the report's author id (null when the author was since deleted).
export type DsrViewer = { id: string; role: string | null };
export type DsrPolicyTarget = { status: string; createdBy: string | null };

const isAuthor = (viewer: DsrViewer, dsr: DsrPolicyTarget) =>
  dsr.createdBy !== null && dsr.createdBy === viewer.id;
const isDsrAdmin = (viewer: DsrViewer) => hasPermission(viewer.role, "dsr.view.all");

/** Edit the report body in place: only while DRAFT, by its author or an admin. */
export function canEditDsr(viewer: DsrViewer, dsr: DsrPolicyTarget): boolean {
  return dsr.status === "DRAFT" && (isAuthor(viewer, dsr) || isDsrAdmin(viewer));
}

/** Approve / send back a SUBMITTED report — the reviewer (admin) decision. */
export function canReviewDsr(viewer: DsrViewer, dsr: DsrPolicyTarget): boolean {
  return dsr.status === "SUBMITTED" && hasPermission(viewer.role, "dsr.review");
}

/**
 * Reopen a locked report back to DRAFT for correction: the author reopens their own
 * SUBMITTED report; an admin reopens any SUBMITTED or APPROVED report.
 */
export function canReopenDsr(viewer: DsrViewer, dsr: DsrPolicyTarget): boolean {
  if (dsr.status === "SUBMITTED") return isAuthor(viewer, dsr) || isDsrAdmin(viewer);
  if (dsr.status === "APPROVED") return isDsrAdmin(viewer);
  return false;
}

/** Delete: an admin may delete any report; the author may delete their own DRAFT. */
export function canDeleteDsr(viewer: DsrViewer, dsr: DsrPolicyTarget): boolean {
  if (isDsrAdmin(viewer)) return true;
  return dsr.status === "DRAFT" && isAuthor(viewer, dsr);
}

export type { DsrIssueInput };

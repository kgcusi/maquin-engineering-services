import type { DsrIssueInput } from "./schema";

// Pure DSR helpers — no server imports.

/** A HIGH-severity issue raises a `dsr.issue.flagged` notification on submit. */
export function hasHighSeverityIssue(issues: readonly { severity: string }[]): boolean {
  return issues.some((i) => i.severity === "HIGH");
}

/** Today's date as YYYY-MM-DD (the DSR is keyed on report_date, one per project). */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export type { DsrIssueInput };

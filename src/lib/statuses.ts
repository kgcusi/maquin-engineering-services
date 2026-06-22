// Fixed status primitives. NO server imports (no db, no drizzle, no next/headers),
// so this is safe to import from CLIENT components (badges, tables), server code,
// and the Drizzle schema. The Drizzle pgEnum for project status is defined in the
// schema file by importing PROJECT_STATUSES below, keeping spellings single-sourced.
//
// Three kinds of status (docs/17 addendum):
//   1. Project lifecycle — STORED pgEnum; a human/workflow decision; code branches on it.
//   2. Task & phase — DERIVED from progress, never stored.
//   3. (Group B workflow enums live with their tables; spellings pinned in docs/17.)

// ── 1. Project lifecycle (projects.status) ──────────────────────────────────
export const PROJECT_STATUSES = [
  "PLANNING",
  "ACTIVE",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNING: "Planning",
  ACTIVE: "Active",
  ON_HOLD: "On Hold",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export function projectStatusLabel(status: string | null | undefined): string {
  return status ? (PROJECT_STATUS_LABELS[status as ProjectStatus] ?? status) : "—";
}

// ── 2. Progress-derived status (tasks & phases) ─────────────────────────────
// Task/phase status is NEVER stored — it falls out of progress_pct (docs/17 §3).
// Same mapping for both: progress is the single source of truth, so the label can
// never contradict the phase/project roll-up.
export const PROGRESS_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "DONE"] as const;

export type ProgressStatus = (typeof PROGRESS_STATUSES)[number];

export const PROGRESS_STATUS_LABELS: Record<ProgressStatus, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  DONE: "Done",
};

export function progressStatusLabel(status: string | null | undefined): string {
  return status ? (PROGRESS_STATUS_LABELS[status as ProgressStatus] ?? status) : "—";
}

/** 0 → Not Started, 1–99 → In Progress, 100 → Done. Used for both tasks and phases. */
export function deriveProgressStatus(progressPct: number): ProgressStatus {
  if (progressPct >= 100) return "DONE";
  if (progressPct <= 0) return "NOT_STARTED";
  return "IN_PROGRESS";
}

// ── 3. Daily Site Report workflow (daily_reports.status) — docs/17 §9-Group B ─
// A STORED two-state lifecycle, pinned here so the pgEnum and the UI share one
// spelling. DRAFT is the working copy (autosaved, editable by its author);
// SUBMITTED locks it (only an admin re-opens, audited).
export const DSR_STATUSES = ["DRAFT", "SUBMITTED"] as const;

export type DsrStatus = (typeof DSR_STATUSES)[number];

export const DSR_STATUS_LABELS: Record<DsrStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
};

export function dsrStatusLabel(status: string | null | undefined): string {
  return status ? (DSR_STATUS_LABELS[status as DsrStatus] ?? status) : "—";
}

// ── DSR issue severity (dsr_issues.severity) ────────────────────────────────
// HIGH is the threshold that raises a `dsr.issue.flagged` notification on submit.
export const DSR_ISSUE_SEVERITIES = ["LOW", "MEDIUM", "HIGH"] as const;

export type DsrIssueSeverity = (typeof DSR_ISSUE_SEVERITIES)[number];

export const DSR_ISSUE_SEVERITY_LABELS: Record<DsrIssueSeverity, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

export function dsrIssueSeverityLabel(severity: string | null | undefined): string {
  return severity ? (DSR_ISSUE_SEVERITY_LABELS[severity as DsrIssueSeverity] ?? severity) : "—";
}

// ── Warranty (derived project fact, not a status) ───────────────────────────
// A project is "in warranty" when work is Completed and we're still inside the
// defects-liability period. Mirrors the `is_delayed` derived-flag pattern.
export function isInWarranty(
  status: string | null | undefined,
  defectsLiabilityUntil: Date | null | undefined,
  asOf: Date,
): boolean {
  return (
    status === "COMPLETED" &&
    defectsLiabilityUntil != null &&
    asOf.getTime() <= defectsLiabilityUntil.getTime()
  );
}

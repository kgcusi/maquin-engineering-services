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

// The status dropdown is the input now, but progress stays the SOURCE of truth so
// the weighted roll-up and the derived badge keep agreeing. Picking a status writes
// its canonical progress: In Progress sits at the 50% midpoint (the 0/50/100
// method). Re-deriving 50 lands back on In Progress, so the two never disagree.
export const PROGRESS_STATUS_VALUE: Record<ProgressStatus, number> = {
  NOT_STARTED: 0,
  IN_PROGRESS: 50,
  DONE: 100,
};

export function progressForStatus(status: ProgressStatus): number {
  return PROGRESS_STATUS_VALUE[status];
}

// {value,label}[] for the Base UI <Select items=…> prop — REQUIRED for the trigger
// to render the selected label (without it the trigger shows blank/the raw value).
export const PROGRESS_STATUS_OPTIONS = PROGRESS_STATUSES.map((value) => ({
  value,
  label: PROGRESS_STATUS_LABELS[value],
}));

// ── Task status (tasks only) — the progress-derived status PLUS Blocked ───────
// Phases never block; tasks do. "Blocked" isn't a fourth point on the progress
// line — it's an overlay that overrides the label while the underlying progress is
// preserved (so the roll-up and unblocking are unaffected). This 4-value set is the
// single status dropdown the user picks from. "Delayed" is NOT here: it's derived
// from the due date, never chosen.
export const TASK_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "DONE"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  BLOCKED: "Blocked",
  DONE: "Done",
};

export function taskStatusLabel(status: string | null | undefined): string {
  return status ? (TASK_STATUS_LABELS[status as TaskStatus] ?? status) : "—";
}

/** Effective task status: Blocked overrides; otherwise it's the progress-derived status. */
export function deriveTaskStatus(progressPct: number, isBlocked: boolean): TaskStatus {
  if (isBlocked) return "BLOCKED";
  return deriveProgressStatus(progressPct);
}

export const TASK_STATUS_OPTIONS = TASK_STATUSES.map((value) => ({
  value,
  label: TASK_STATUS_LABELS[value],
}));

// ── 3. Daily Site Report workflow (daily_reports.status) — docs/17 §9-Group B ─
// A STORED two-state lifecycle, pinned here so the pgEnum and the UI share one
// spelling. DRAFT is the working copy (autosaved, editable by its author);
// SUBMITTED locks it (only an admin re-opens, audited).
export const DSR_STATUSES = ["DRAFT", "SUBMITTED", "APPROVED"] as const;

export type DsrStatus = (typeof DSR_STATUSES)[number];

export const DSR_STATUS_LABELS: Record<DsrStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
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

// ── Inspection (QA/QC) workflow (inspections.status) — docs/17 §10.9–10.10 ────
// A STORED lifecycle for a project-scoped QA/QC inspection. An engineer raises a
// REQUEST naming a QA/QC engineer; the inspector records the outcome — PASSED or
// FAILED (+remarks). Advisory: it never gates task/project completion.
export const INSPECTION_STATUSES = ["REQUESTED", "PASSED", "FAILED"] as const;

export type InspectionStatus = (typeof INSPECTION_STATUSES)[number];

export const INSPECTION_STATUS_LABELS: Record<InspectionStatus, string> = {
  REQUESTED: "Requested",
  PASSED: "Passed",
  FAILED: "Failed",
};

export function inspectionStatusLabel(status: string | null | undefined): string {
  return status ? (INSPECTION_STATUS_LABELS[status as InspectionStatus] ?? status) : "—";
}

// ── Inspection checklist item result (inspection_item_results.result) ─────────
// Per-item call the QA/QC engineer records on each attempt. PASS/FAIL are the
// substantive outcomes; NA (not applicable) lets an inspector skip an item that
// doesn't apply to this work without it counting against the result. The overall
// inspection PASSED/FAILED stays a deliberate human decision — items are evidence,
// never an auto-gate (docs/17 §10.16).
export const INSPECTION_ITEM_RESULTS = ["PASS", "FAIL", "NA"] as const;

export type InspectionItemResult = (typeof INSPECTION_ITEM_RESULTS)[number];

export const INSPECTION_ITEM_RESULT_LABELS: Record<InspectionItemResult, string> = {
  PASS: "Pass",
  FAIL: "Fail",
  NA: "N/A",
};

export function inspectionItemResultLabel(result: string | null | undefined): string {
  return result ? (INSPECTION_ITEM_RESULT_LABELS[result as InspectionItemResult] ?? result) : "—";
}

export const INSPECTION_ITEM_RESULT_OPTIONS = INSPECTION_ITEM_RESULTS.map((value) => ({
  value,
  label: INSPECTION_ITEM_RESULT_LABELS[value],
}));

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

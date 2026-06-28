// Pure template logic — NO server imports, so it's shared by the guarded actions,
// the instantiation service, and unit tests. The calendar-day chaining here is the
// heart of "create a project from a template" (docs/17 §10.17).

import { round2 } from "@/modules/projects/tasks/domain";

export const TEMPLATE_ENTITY = "project_template";

// Phase weight allocation: a phase's tasks each carry a share of its 100%. This
// tolerance matches the tasks-module guard so the review-step hint, the submit
// gating, and the instantiation guard all agree on what "over 100%" means.
export const WEIGHT_EPSILON = 0.001;

/** Rounded sum (2 dp) of a phase's task weights. Non-finite entries count as 0. */
export function phaseWeightTotal(weights: number[]): number {
  return round2(weights.reduce((sum, w) => sum + (Number.isFinite(w) ? w : 0), 0));
}

/** True when a phase's allocated weight exceeds 100% (beyond float tolerance). */
export function isPhaseOverAllocated(total: number): boolean {
  return total > 100 + WEIGHT_EPSILON;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Add N calendar days to a `YYYY-MM-DD` string, returning `YYYY-MM-DD`. Uses UTC so
 *  the arithmetic never drifts across DST/local-offset boundaries — these are
 *  calendar dates, not instants. */
export function addCalendarDays(isoDate: string, days: number): string {
  if (!ISO_DATE.test(isoDate)) throw new Error(`Expected YYYY-MM-DD, got "${isoDate}"`);
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export type PhaseSchedule = { targetStartDate: string; targetEndDate: string };

/**
 * Lay phases end-to-end on the calendar from a single project start date.
 * Phase 1 starts on `startDate`; each phase ends `duration − 1` days later
 * (inclusive), and the next phase starts the following day. Durations are clamped
 * to ≥ 1 so a stray 0 can't collapse a phase onto the previous one.
 *
 *   startDate 2026-07-01, durations [7, 21] →
 *     [{ 2026-07-01 → 2026-07-07 }, { 2026-07-08 → 2026-07-28 }]
 */
export function chainPhaseSchedule(startDate: string, durations: number[]): PhaseSchedule[] {
  if (!ISO_DATE.test(startDate)) throw new Error(`Expected YYYY-MM-DD, got "${startDate}"`);
  const out: PhaseSchedule[] = [];
  let cursorStart = startDate;
  for (const raw of durations) {
    const duration = Math.max(1, Math.trunc(raw));
    const targetStartDate = cursorStart;
    const targetEndDate = addCalendarDays(cursorStart, duration - 1);
    out.push({ targetStartDate, targetEndDate });
    cursorStart = addCalendarDays(targetEndDate, 1);
  }
  return out;
}

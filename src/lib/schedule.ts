// Pure scheduling math for the project overview — time-linear expected progress,
// schedule variance, and Gantt date positioning. NO server imports (client- and
// test-safe). Dates are "YYYY-MM-DD" strings parsed at LOCAL midnight, matching the
// rest of the UI (`new Date(`${iso}T00:00:00`)`) so the day boundary never drifts.

function parseLocal(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Slack (percentage points) before a gap counts as ahead/behind — keeps rounding
// and a single day of drift from flickering the schedule signal.
const VARIANCE_SLACK = 2;

/** Time-linear expected progress 0–100 between `start` and `end`, as of `today`.
 *  Null when a bound is missing — the caller renders a "set dates" affordance. */
export function expectedProgressPct(
  start: string | null,
  end: string | null,
  today: string,
): number | null {
  const s = parseLocal(start);
  const e = parseLocal(end);
  const t = parseLocal(today);
  if (!s || !e || !t) return null;
  const span = e.getTime() - s.getTime();
  if (span <= 0) return t.getTime() >= e.getTime() ? 100 : 0;
  if (t.getTime() <= s.getTime()) return 0;
  if (t.getTime() >= e.getTime()) return 100;
  return ((t.getTime() - s.getTime()) / span) * 100;
}

export type ScheduleState = "ahead" | "on_track" | "behind";

/** Actual progress vs time-based expected. `null` expected → on_track (nothing to
 *  judge against). `delta` is signed percentage points (positive = ahead). */
export function scheduleVariance(
  actualPct: number,
  expectedPct: number | null,
): { delta: number; state: ScheduleState } {
  if (expectedPct == null) return { delta: 0, state: "on_track" };
  const delta = actualPct - expectedPct;
  if (delta > VARIANCE_SLACK) return { delta, state: "ahead" };
  if (delta < -VARIANCE_SLACK) return { delta, state: "behind" };
  return { delta, state: "on_track" };
}

/** Per-bar health for the Gantt. `done` wins; then `overdue` (open past target end);
 *  then `behind` (lagging the time-linear plan); else `on_track`. */
export type BarState = "done" | "overdue" | "behind" | "on_track";

export function barState(
  progressPct: number,
  targetEnd: string | null,
  expectedPct: number | null,
  today: string,
): BarState {
  if (progressPct >= 100) return "done";
  const te = parseLocal(targetEnd);
  const t = parseLocal(today);
  if (te && t && t.getTime() > te.getTime()) return "overdue";
  if (expectedPct != null && progressPct < expectedPct - VARIANCE_SLACK) return "behind";
  return "on_track";
}

/** Min/max epoch ms across a set of "YYYY-MM-DD" dates (nulls ignored).
 *  Null when none are valid — the Gantt then shows its empty state. */
export function spanBounds(
  dates: (string | null | undefined)[],
): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  for (const iso of dates) {
    const d = parseLocal(iso);
    if (!d) continue;
    const ms = d.getTime();
    if (ms < min) min = ms;
    if (ms > max) max = ms;
  }
  return Number.isFinite(min) && Number.isFinite(max) ? { min, max } : null;
}

/** Position of `iso` within [min,max] as a 0–100 %. Clamped. Null when undated. */
export function datePos(iso: string | null | undefined, min: number, max: number): number | null {
  const d = parseLocal(iso);
  if (!d) return null;
  if (max <= min) return 0;
  return Math.max(0, Math.min(100, ((d.getTime() - min) / (max - min)) * 100));
}

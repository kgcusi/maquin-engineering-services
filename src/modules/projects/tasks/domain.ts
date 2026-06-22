// Pure phase/task domain rules — NO server imports, so they're unit-testable and
// client-safe. The progress SQL roll-up itself lives in actions.ts (needs the db);
// these are the arithmetic + delayed-flag predicates around it.

/** Round a percentage to 2 decimals (matches numeric(5,2)). */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Display-only "delayed": the stored transition flag OR the live past-due
 *  derivation (an open task past its due date). The read path NEVER writes this —
 *  the nightly job owns the stored flag (docs/17 §10.7). Dates are YYYY-MM-DD. */
export function isTaskDelayed(
  progressPct: number,
  dueDate: string | null,
  isDelayedFlag: boolean,
  today: string,
): boolean {
  if (isDelayedFlag) return true;
  return progressPct < 100 && dueDate != null && dueDate < today;
}

/** When a task is no longer "open and past due", the STORED delayed flag should
 *  clear so a later slip re-notifies. True when complete, undated, or due today/
 *  later. Applied on every task write; the nightly job re-sets it on a fresh slip. */
export function shouldClearDelayed(
  progressPct: number,
  dueDate: string | null,
  today: string,
): boolean {
  return progressPct >= 100 || dueDate == null || dueDate >= today;
}

/** A blocked task must carry a reason (form + server share this rule). */
export function blockedReasonOk(input: {
  isBlocked: boolean;
  blockedReason?: string | null;
}): boolean {
  return !input.isBlocked || !!(input.blockedReason && input.blockedReason.trim().length > 0);
}

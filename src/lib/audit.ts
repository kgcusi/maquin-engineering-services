import type { Database } from "@/db/client";
import { auditLogs } from "@/db/schema/audit-logs";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export type AuditEntry = {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  diff?: unknown;
};

export type FieldDiff = Record<string, { from: unknown; to: unknown }>;

// Empty string / undefined and null are the SAME absence of a value: the forms
// submit "" for a cleared optional field, which the actions normalize to null on
// write — so an edit that leaves a blank field blank is not a change.
function sameValue(a: unknown, b: unknown): boolean {
  const na = a === "" || a === undefined ? null : a;
  const nb = b === "" || b === undefined ? null : b;
  return na === nb;
}

/**
 * Build an audit diff holding ONLY the fields that actually changed. For each key
 * in `after`, emit a `{ from, to }` entry when its value differs from `before`;
 * unchanged keys are omitted. Returns `undefined` when nothing changed, so a no-op
 * edit records an empty diff the viewer renders as "no field-level changes" instead
 * of a wall of identical before/after rows. Pass display-ready primitives (strings
 * or null) — convert Money/dates to their string form at the call site.
 */
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): FieldDiff | undefined {
  const diff: FieldDiff = {};
  for (const key of Object.keys(after)) {
    if (!sameValue(before[key], after[key])) diff[key] = { from: before[key], to: after[key] };
  }
  return Object.keys(diff).length ? diff : undefined;
}

/**
 * Append an audit row INSIDE the caller's transaction (docs/12) — so the audit
 * is atomic with the action it records. The table is append-only (DB trigger).
 */
export async function audit(tx: Tx, entry: AuditEntry): Promise<void> {
  await tx.insert(auditLogs).values({
    actorId: entry.actorId ?? null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    summary: entry.summary,
    diff: entry.diff ?? null,
  });
}

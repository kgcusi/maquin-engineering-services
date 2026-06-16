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

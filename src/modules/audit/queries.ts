import { and, asc, count, desc, eq, gte, isNull, lte, notInArray, or, type SQL } from "drizzle-orm";

import { db } from "@/db/client";
import { auditLogs } from "@/db/schema/audit-logs";
import { user } from "@/db/schema/auth";
import { HIDDEN_ROLES, visibleUserWhere } from "@/lib/rbac";
import type { Paginated } from "@/modules/shared/list-params";

import type { AuditFilterValues } from "./schema";

// `audit_logs` is append-only and grows for the life of the system, so the
// viewer reads it in bounded pages (newest-first) rather than loading the whole
// table client-side. The table's created/actor/entity indexes back these reads.
export const AUDIT_PAGE_SIZE = 50;

export type AuditLogRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  diff: unknown;
  createdAt: Date;
  actorId: string | null;
  // Joined from `user`. `actorName` is null when the actor row is gone (the FK
  // is ON DELETE SET NULL → actorId also null) — render those as "System".
  actorName: string | null;
  actorEmail: string | null;
  actorRole: string | null;
};

// Same shape as every other paginated list so the viewer can reuse the shared
// numbered footer (`TablePagination`) — consistent paging across the whole app.
export type AuditPage = Paginated<AuditLogRow>;

// The hidden WEBMASTER must never be exposed as a selectable actor — the dropdown
// is built from visible users only (mirrors every other user picker, docs/03).
export type ActorOption = { id: string; name: string };

const auditColumns = {
  id: auditLogs.id,
  action: auditLogs.action,
  entityType: auditLogs.entityType,
  entityId: auditLogs.entityId,
  summary: auditLogs.summary,
  diff: auditLogs.diff,
  createdAt: auditLogs.createdAt,
  actorId: auditLogs.actorId,
  actorName: user.name,
  actorEmail: user.email,
  actorRole: user.role,
} as const;

function filterClauses(filters: AuditFilterValues): SQL | undefined {
  const clauses: SQL[] = [];
  if (filters.actorId) clauses.push(eq(auditLogs.actorId, filters.actorId));
  if (filters.action) clauses.push(eq(auditLogs.action, filters.action));
  if (filters.entityType) clauses.push(eq(auditLogs.entityType, filters.entityType));
  if (filters.from) clauses.push(gte(auditLogs.createdAt, new Date(filters.from)));
  // Include the whole `to` day (timestamps run past midnight).
  if (filters.to) clauses.push(lte(auditLogs.createdAt, new Date(`${filters.to}T23:59:59.999Z`)));
  return clauses.length ? and(...clauses) : undefined;
}

/** Global audit viewer: filtered, newest-first, one page at a time, with a
 *  sibling COUNT(*) over the same WHERE for the numbered footer's "of Z" total.
 *  A non-webmaster viewer never sees the hidden superuser's own actions (the
 *  hidden-superuser invariant, docs/03) — genuine null-actor "System" rows stay
 *  visible. A webmaster viewer sees everything. */
export async function listAuditLogs(
  filters: AuditFilterValues,
  viewerIsWebmaster: boolean,
): Promise<AuditPage> {
  const { page } = filters;
  // Keep null-actor/System and visible-user rows; drop webmaster-actor rows
  // (non-null actorId whose role is hidden — both OR branches are false).
  const visibilityClause = viewerIsWebmaster
    ? undefined
    : or(isNull(auditLogs.actorId), notInArray(user.role, HIDDEN_ROLES as string[]));
  const where = and(filterClauses(filters), visibilityClause);

  const [rows, [{ value: total }]] = await Promise.all([
    db
      .select(auditColumns)
      .from(auditLogs)
      .leftJoin(user, eq(auditLogs.actorId, user.id))
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(AUDIT_PAGE_SIZE)
      .offset((page - 1) * AUDIT_PAGE_SIZE),
    // The visibility clause references the joined user.role, so the count needs
    // the same leftJoin.
    db
      .select({ value: count() })
      .from(auditLogs)
      .leftJoin(user, eq(auditLogs.actorId, user.id))
      .where(where),
  ]);

  return { rows, total, page, pageSize: AUDIT_PAGE_SIZE };
}

/** The audit trail for a single record, newest-first. Reusable by the future
 *  per-entity "History" panel on Stage 2+ detail pages (project, MR, expense…). */
export async function getEntityAuditTrail(
  entityType: string,
  entityId: string,
): Promise<AuditLogRow[]> {
  return db
    .select(auditColumns)
    .from(auditLogs)
    .leftJoin(user, eq(auditLogs.actorId, user.id))
    .where(and(eq(auditLogs.entityType, entityType), eq(auditLogs.entityId, entityId)))
    .orderBy(desc(auditLogs.createdAt));
}

/** Actors for the filter dropdown. The hidden WEBMASTER is excluded by default
 *  (every other user picker does the same) — but a WEBMASTER viewer, who already
 *  knows the account exists, may include it so they can filter their own actions.
 *  Soft-deleted users are always excluded. */
export async function listActorOptions(includeHidden = false): Promise<ActorOption[]> {
  return db
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(includeHidden ? isNull(user.deletedAt) : visibleUserWhere())
    .orderBy(asc(user.name));
}

// Filter option lists are data-driven (DISTINCT over the column) so they reflect
// whatever each later stage starts logging — no hard-coded action/entity enum.
export async function listActionOptions(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ action: auditLogs.action })
    .from(auditLogs)
    .orderBy(asc(auditLogs.action));
  return rows.map((r) => r.action);
}

export async function listEntityTypeOptions(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ entityType: auditLogs.entityType })
    .from(auditLogs)
    .orderBy(asc(auditLogs.entityType));
  return rows.map((r) => r.entityType);
}

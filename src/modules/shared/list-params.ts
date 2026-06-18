import { ilike, or, type Column, type SQL } from "drizzle-orm";
import { z } from "zod";

// Shared paging + search primitives for every bounded list (directory tables and
// the detail-page Notes/Documents panels). Mirrors the audit-log gold standard
// (`src/modules/audit/queries.ts`): paging lives in the URL, search runs
// server-side, and a sibling COUNT(*) powers the "of Z" total. Pure — NO server
// imports beyond Drizzle's SQL builders — so it stays unit-testable.

/** Rows per page for the directory tables (clients, employees, suppliers, users). */
export const PAGE_SIZE = 25;
/** Rows per page for the compact detail-page panels (Notes, Documents). */
export const PANEL_PAGE_SIZE = 10;

// A 1-based page from a query string. Every value has a fallback so `.parse()`
// never throws on a hostile/garbage param — it simply falls back to page 1.
const pageField = z.coerce.number().int().min(1).catch(1);
// A free-text search key: trimmed, non-empty, else dropped (→ undefined).
const searchField = z.string().trim().min(1).optional().catch(undefined);

/** Raw `searchParams` → a typed directory list query (`?page=`, `?q=`). */
export const directoryListSchema = z.object({
  page: pageField,
  q: searchField,
});
export type DirectoryListParams = z.infer<typeof directoryListSchema>;

/** Parse a single (possibly namespaced) page param — e.g. `?docsPage=2` on a
 *  detail page hosting more than one paginated panel. Falls back to page 1. */
export function pageParam(value: unknown): number {
  return pageField.parse(value);
}

/** One page of a list plus the full-set total that drives the numbered footer. */
export type Paginated<T> = {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
};

// Escape LIKE/ILIKE wildcards so a typed "%" or "_" matches that literal
// character instead of acting as a pattern. Backslash is Postgres' default LIKE
// escape character, so we double it as well. Exported for unit testing.
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/**
 * OR-of-ILIKE across the given columns for a free-text query — a case-insensitive
 * "contains" match. Returns `undefined` when the query is empty so callers can
 * compose it directly: `and(baseWhere, searchClause(q, [a, b]))`.
 */
export function searchClause(q: string | undefined, columns: Column[]): SQL | undefined {
  if (!q) return undefined;
  const pattern = `%${escapeLike(q)}%`;
  return or(...columns.map((column) => ilike(column, pattern)));
}

/** Zero-based row offset for a 1-based page. */
export function offsetFor(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}

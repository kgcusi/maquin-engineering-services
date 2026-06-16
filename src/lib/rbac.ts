import { notInArray } from "drizzle-orm";
import { z } from "zod";

import { db, type Database } from "@/db/client";
import { user } from "@/db/schema/auth";
import { getSession, type SessionUser } from "@/lib/session";

// ── Permission keys (docs/03 §2) — the stable contract ──────────────────────
// Roles are just bundles of these. Guards check keys, never role strings, so a
// new role (Storekeeper, Accountant…) is purely additive later.
export const PERMISSION_KEYS = [
  // Users
  "user.view",
  "user.create",
  "user.update",
  "user.deactivate",
  // Settings
  "settings.view",
  "settings.manage",
  // Audit
  "audit.view",
  // Directory
  "employee.view",
  "employee.manage",
  "client.view",
  "client.manage",
  "supplier.view",
  "supplier.manage",
  // Projects
  "project.view.all",
  "project.view.assigned",
  "project.create",
  "project.update",
  "project.delete",
  // Phases / Tasks
  "task.view",
  "task.manage",
  "task.update.progress",
  // Daily Site Reports
  "dsr.view",
  "dsr.create",
  "dsr.update.own",
  "dsr.view.all",
  // Budget
  "budget.view",
  "budget.manage",
  "budget.adjust",
  // Expenses
  "expense.view",
  "expense.create",
  "expense.approve",
  // Cash Flow
  "cashflow.view",
  "cashflow.manage",
  // Approvals
  "approval.view",
  "approval.decide",
  // Inventory master
  "item.view",
  "item.manage",
  "location.manage",
  // Stock-In
  "stockin.view",
  "stockin.create",
  // Material Requests
  "mr.view.assigned",
  "mr.view.all",
  "mr.create",
  "mr.approve",
  // Release / Receiving
  "release.create",
  "receiving.confirm",
  // Movements
  "movement.create",
  "movement.approve",
  // Ledger
  "ledger.view",
  // Reports
  "report.view",
  "report.export",
  // Dashboard
  "dashboard.admin",
  "dashboard.engineer",
  // Notifications
  "notification.settings.manage",
] as const;

export type Permission = (typeof PERMISSION_KEYS)[number];

// ── Roles ───────────────────────────────────────────────────────────────────
export const ROLES = {
  /** Hidden superuser — full access, never shown in any user listing. */
  WEBMASTER: "WEBMASTER",
  ADMIN: "ADMIN",
  ENGINEER: "ENGINEER",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

// Engineer bundle (docs/03 §3 matrix; scoped to assigned projects at query time).
// expense.create and budget.view are intentionally withheld for v1 (optional/
// configurable per docs/03 §3–4); flip them on here when the firm decides.
const ENGINEER_PERMISSIONS: Permission[] = [
  "project.view.assigned",
  "task.view",
  "task.update.progress",
  "dsr.view",
  "dsr.create",
  "dsr.update.own",
  "mr.view.assigned",
  "mr.create",
  "receiving.confirm",
  "movement.create",
  "ledger.view",
  "report.view",
  "report.export",
  "dashboard.engineer",
];

// Admin gets everything except the engineer-only / engineer-scoped duplicates.
const ENGINEER_ONLY: Permission[] = [
  "project.view.assigned",
  "dsr.update.own",
  "mr.view.assigned",
  "dashboard.engineer",
];
const ADMIN_PERMISSIONS: Permission[] = PERMISSION_KEYS.filter(
  (key) => !ENGINEER_ONLY.includes(key),
);

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  // Webmaster = the whole contract. Full access, by design.
  WEBMASTER: new Set(PERMISSION_KEYS),
  ADMIN: new Set(ADMIN_PERMISSIONS),
  ENGINEER: new Set(ENGINEER_PERMISSIONS),
};

// ── Hidden roles (the webmaster must never surface) ─────────────────────────
export const HIDDEN_ROLES: readonly string[] = [ROLES.WEBMASTER];

export function isHiddenRole(role: string | null | undefined): boolean {
  return role != null && HIDDEN_ROLES.includes(role);
}

/**
 * Drizzle predicate that excludes hidden roles. EVERY user listing, count, and
 * approver/assignee picker MUST apply this — server-side — or the hidden
 * webmaster leaks. (There is no Users list yet; this is the contract for Stage 1.)
 */
export function visibleUserWhere() {
  return notInArray(user.role, HIDDEN_ROLES as string[]);
}

// ── Checks ──────────────────────────────────────────────────────────────────
function roleOf(u: SessionUser | { role?: string | null }): string | null {
  return (u as { role?: string | null }).role ?? null;
}

export function hasPermission(role: string | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  const perms = ROLE_PERMISSIONS[role as Role];
  return perms?.has(permission) ?? false;
}

export function requirePermission(role: string | null | undefined, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`Forbidden: missing permission "${permission}"`);
  }
}

// ── The one Server Action guard (docs/17 §5) ────────────────────────────────
// session → is_active → permission → validate(zod) → db.transaction(handler).
// No raw Server Action should bypass this — an unguarded action is a public POST.
// Project-scoping for engineers is injected here once the projects table exists
// (Stage 2); the hook is the `ctx` passed to the handler.

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export type ActionContext = { user: SessionUser; tx: Tx };

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export function action<TInput, TOutput>(
  permission: Permission,
  schema: z.ZodType<TInput>,
  handler: (input: TInput, ctx: ActionContext) => Promise<TOutput>,
): (rawInput: unknown) => Promise<ActionResult<TOutput>> {
  return async (rawInput) => {
    const session = await getSession();
    if (!session) return { ok: false, error: "Not authenticated" };

    const sessionUser = session.user;
    if ((sessionUser as { isActive?: boolean }).isActive === false) {
      return { ok: false, error: "Account is inactive" };
    }
    if (!hasPermission(roleOf(sessionUser), permission)) {
      return { ok: false, error: "Forbidden" };
    }

    const parsed = schema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input",
      };
    }

    const data = await db.transaction((tx) => handler(parsed.data, { user: sessionUser, tx }));
    return { ok: true, data };
  };
}

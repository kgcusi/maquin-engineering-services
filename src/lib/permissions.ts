import { type Role } from "@/lib/roles";

// Pure permission model — NO server imports (no db, no next/headers), so it is
// safe to import from client components and unit tests. The DB-coupled guard
// (action(), visibleUserWhere) lives in src/lib/rbac.ts, which re-exports these.

// ── Permission keys (docs/03 §2) — the stable contract ──────────────────────
// Roles are just bundles of these. Guards check keys, never role strings, so a
// new role (Storekeeper, Accountant…) is purely additive later.
export const PERMISSION_KEYS = [
  // Users
  "user.view",
  "user.create",
  "user.update",
  "user.deactivate",
  "user.delete",
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
  // QA/QC Inspection — role + keys ship Stage 2; the request→inspect→pass/fail
  // module is deferred (docs/17 §10.10). Reserved so the bundles are stable.
  "inspection.view",
  "inspection.request",
  "inspection.record",
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
  "notification.view",
  "notification.settings.manage",
] as const;

export type Permission = (typeof PERMISSION_KEYS)[number];

// Engineer bundle (docs/03 §3 matrix; scoped to assigned projects at query time).
// expense.create and budget.view are intentionally withheld for v1 (optional/
// configurable per docs/03 §3–4); flip them on here when the firm decides.
const ENGINEER_PERMISSIONS: Permission[] = [
  "project.view.assigned",
  "task.view",
  // Assigned engineers create/assign/edit tasks on their projects (docs/17 §10.14),
  // scoped via assertProjectAccess — not just the narrower progress quick-path.
  "task.manage",
  "task.update.progress",
  "dsr.view",
  "dsr.create",
  "dsr.update.own",
  // An assigned engineer requests an inspection (names a QA/QC); the request grants
  // that inspector INSPECTOR membership. Reserved — the module lands post-Stage-2.
  "inspection.request",
  "mr.view.assigned",
  "mr.create",
  "receiving.confirm",
  "movement.create",
  "ledger.view",
  "report.view",
  "report.export",
  "dashboard.engineer",
  // Every signed-in user sees their own in-app notifications (the topbar bell).
  "notification.view",
];

// QA/QC engineer — a non-admin inspection role (docs/17 §10.9). Reads the work it
// inspects (project/task/DSR, scoped to projects it was granted INSPECTOR
// membership on) and records inspection outcomes. NOT in Better Auth `adminRoles`.
const QA_QC_PERMISSIONS: Permission[] = [
  "project.view.assigned",
  "task.view",
  "dsr.view",
  "inspection.view",
  "inspection.record",
  "notification.view",
];

// Admin gets everything except the engineer-only / engineer-scoped duplicates and
// the webmaster-only keys.
const ENGINEER_ONLY: Permission[] = [
  "project.view.assigned",
  "dsr.update.own",
  "mr.view.assigned",
  "dashboard.engineer",
];
// System Settings is the hidden superuser's panel, not a day-to-day admin screen —
// keep these out of the ADMIN bundle. WEBMASTER still has them via the full set.
const WEBMASTER_ONLY: Permission[] = ["settings.view", "settings.manage"];
const ADMIN_PERMISSIONS: Permission[] = PERMISSION_KEYS.filter(
  (key) => !ENGINEER_ONLY.includes(key) && !WEBMASTER_ONLY.includes(key),
);

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  // Webmaster = the whole contract. Full access, by design.
  WEBMASTER: new Set(PERMISSION_KEYS),
  ADMIN: new Set(ADMIN_PERMISSIONS),
  ENGINEER: new Set(ENGINEER_PERMISSIONS),
  QA_QC_ENGINEER: new Set(QA_QC_PERMISSIONS),
};

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

// Pure authorization primitives — NO server imports (no db, no next/headers), so
// this is safe to import from CLIENT components (forms, tables) as well as server
// code. The DB-coupled guard (action(), visibleUserWhere) stays in src/lib/rbac.ts,
// which re-exports these for server callers.

export const ROLES = {
  /** Hidden superuser — full access, never shown in any user listing. */
  WEBMASTER: "WEBMASTER",
  ADMIN: "ADMIN",
  ENGINEER: "ENGINEER",
  /** Inspection-only field role (docs/17 §10.9). Visible + non-admin like ENGINEER;
   *  its power comes from ROLE_PERMISSIONS, NOT Better Auth `adminRoles`. */
  QA_QC_ENGINEER: "QA_QC_ENGINEER",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/** Roles an admin may assign through the UI. WEBMASTER is seed/DB-only. */
export const ASSIGNABLE_ROLES = [ROLES.ADMIN, ROLES.ENGINEER, ROLES.QA_QC_ENGINEER] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export const ROLE_LABELS: Record<string, string> = {
  [ROLES.WEBMASTER]: "Webmaster",
  [ROLES.ADMIN]: "Admin",
  [ROLES.ENGINEER]: "Engineer",
  [ROLES.QA_QC_ENGINEER]: "QA/QC Engineer",
};

export function roleLabel(role: string | null | undefined): string {
  return role ? (ROLE_LABELS[role] ?? role) : "—";
}

// The webmaster must never surface in any listing, count, or picker.
export const HIDDEN_ROLES: readonly string[] = [ROLES.WEBMASTER];

export function isHiddenRole(role: string | null | undefined): boolean {
  return role != null && HIDDEN_ROLES.includes(role);
}

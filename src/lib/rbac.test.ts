import { describe, expect, it } from "vitest";

import { PERMISSION_KEYS, ROLE_PERMISSIONS, hasPermission } from "@/lib/permissions";
import { HIDDEN_ROLES, ROLES, isHiddenRole } from "@/lib/roles";

const USER_PERMS = [
  "user.view",
  "user.create",
  "user.update",
  "user.deactivate",
  "user.delete",
] as const;

describe("RBAC permission matrix", () => {
  it("ADMIN can manage users", () => {
    for (const key of USER_PERMS) {
      expect(hasPermission(ROLES.ADMIN, key)).toBe(true);
    }
  });

  it("ENGINEER cannot manage users", () => {
    for (const key of USER_PERMS) {
      expect(hasPermission(ROLES.ENGINEER, key)).toBe(false);
    }
  });

  it("WEBMASTER holds every permission", () => {
    for (const key of PERMISSION_KEYS) {
      expect(hasPermission(ROLES.WEBMASTER, key)).toBe(true);
    }
    expect(ROLE_PERMISSIONS.WEBMASTER.size).toBe(PERMISSION_KEYS.length);
  });

  it("scopes the engineer vs admin dashboards", () => {
    expect(hasPermission(ROLES.ENGINEER, "dashboard.engineer")).toBe(true);
    expect(hasPermission(ROLES.ENGINEER, "dashboard.admin")).toBe(false);
    expect(hasPermission(ROLES.ADMIN, "dashboard.admin")).toBe(true);
  });

  it("gates System Settings to WEBMASTER only", () => {
    for (const key of ["settings.view", "settings.manage"] as const) {
      expect(hasPermission(ROLES.WEBMASTER, key)).toBe(true);
      expect(hasPermission(ROLES.ADMIN, key)).toBe(false);
      expect(hasPermission(ROLES.ENGINEER, key)).toBe(false);
    }
  });

  it("denies missing or unknown roles", () => {
    expect(hasPermission(null, "user.view")).toBe(false);
    expect(hasPermission(undefined, "user.view")).toBe(false);
    expect(hasPermission("STOREKEEPER", "user.view")).toBe(false);
  });
});

describe("hidden webmaster", () => {
  it("flags WEBMASTER as hidden, others visible", () => {
    expect(isHiddenRole(ROLES.WEBMASTER)).toBe(true);
    expect(isHiddenRole(ROLES.ADMIN)).toBe(false);
    expect(isHiddenRole(ROLES.ENGINEER)).toBe(false);
    expect(isHiddenRole(null)).toBe(false);
    expect(HIDDEN_ROLES).toContain(ROLES.WEBMASTER);
  });
});

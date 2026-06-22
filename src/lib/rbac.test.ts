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

describe("Stage 2 project RBAC", () => {
  it("gives ENGINEER scoped task.manage + inspection.request, not admin powers", () => {
    expect(hasPermission(ROLES.ENGINEER, "task.manage")).toBe(true);
    expect(hasPermission(ROLES.ENGINEER, "task.update.progress")).toBe(true);
    expect(hasPermission(ROLES.ENGINEER, "inspection.request")).toBe(true);
    expect(hasPermission(ROLES.ENGINEER, "project.view.assigned")).toBe(true);
    expect(hasPermission(ROLES.ENGINEER, "project.create")).toBe(false);
    expect(hasPermission(ROLES.ENGINEER, "project.view.all")).toBe(false);
    expect(hasPermission(ROLES.ENGINEER, "dsr.view.all")).toBe(false);
  });

  it("scopes QA_QC_ENGINEER to inspection + read-only project visibility", () => {
    expect(hasPermission(ROLES.QA_QC_ENGINEER, "task.view")).toBe(true);
    expect(hasPermission(ROLES.QA_QC_ENGINEER, "dsr.view")).toBe(true);
    expect(hasPermission(ROLES.QA_QC_ENGINEER, "inspection.view")).toBe(true);
    expect(hasPermission(ROLES.QA_QC_ENGINEER, "inspection.record")).toBe(true);
    expect(hasPermission(ROLES.QA_QC_ENGINEER, "project.view.assigned")).toBe(true);
    // Inspection-only: no write power over tasks/projects/DSRs.
    expect(hasPermission(ROLES.QA_QC_ENGINEER, "task.manage")).toBe(false);
    expect(hasPermission(ROLES.QA_QC_ENGINEER, "task.update.progress")).toBe(false);
    expect(hasPermission(ROLES.QA_QC_ENGINEER, "dsr.create")).toBe(false);
    expect(hasPermission(ROLES.QA_QC_ENGINEER, "project.create")).toBe(false);
  });

  it("gives ADMIN firm-wide project + DSR reach, not the engineer-scoped keys", () => {
    for (const key of [
      "project.create",
      "project.update",
      "project.delete",
      "project.view.all",
      "dsr.view.all",
    ] as const) {
      expect(hasPermission(ROLES.ADMIN, key)).toBe(true);
    }
    expect(hasPermission(ROLES.ADMIN, "project.view.assigned")).toBe(false);
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

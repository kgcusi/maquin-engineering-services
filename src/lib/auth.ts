import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";

import { db } from "../db/client";

// Better Auth owns authentication and the canonical user/session/account/
// verification tables. Authorization (permission keys, project scoping) stays
// in our code/DB — see src/lib/rbac.ts (Stage 1). docs/16-tech-decisions.md §3.
export const auth = betterAuth({
  appName: "PMTIS",
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: {
    enabled: true,
    // No public signup — accounts are admin-provisioned only
    // (docs/13 §1, docs/16 §3). Provisioning runs through the admin plugin/seed.
    disableSignUp: true,
  },
  user: {
    additionalFields: {
      // Domain flag distinct from the admin plugin's `banned`; the session
      // guard denies inactive users (docs/17 §3).
      isActive: {
        type: "boolean",
        required: false,
        defaultValue: true,
        input: false,
      },
      employeeId: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
  // Admin plugin: provisioning (createUser / list / ban / setRole / impersonate)
  // and the `role` column. `adminRoles` only lists roles Better Auth itself
  // recognizes for its built-in admin endpoints (a novel role would fail Better
  // Auth's role validation). WEBMASTER is intentionally NOT here: authorization is
  // OURS (docs/16 §3) — WEBMASTER's full access comes from src/lib/rbac.ts
  // ROLE_PERMISSIONS, and provisioning calls go through our guarded actions /
  // the seed (no-headers bypass), not Better Auth's own admin gate. WEBMASTER is
  // also hidden from every user listing (rbac.ts HIDDEN_ROLES).
  plugins: [admin({ defaultRole: "ENGINEER", adminRoles: ["ADMIN"] })],
});

export type Auth = typeof auth;

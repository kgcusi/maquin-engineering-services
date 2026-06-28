import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
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
    // No upper cap, with an 8-character floor (best-practice minimum; relaxes the
    // docs/13 §1 value of 12). The high max bounds scrypt cost on absurd input
    // while sitting far beyond any real password. The Zod schema
    // (src/modules/users/schema.ts) mirrors these bounds.
    minPasswordLength: 8,
    maxPasswordLength: 1024,
  },
  session: {
    // Cookie cache: a short-lived, SIGNED snapshot of session + user (role,
    // isActive, employeeId) stored in a cookie. `getSession()` reads it WITHOUT a
    // DB hit until it expires — this is the main lever that cuts per-render and
    // per-action session lookups (the user's "save DB calls" goal). The READ path
    // (AuthGate, src/lib/session.ts `getSession`) is served from here; the WRITE
    // path (the `action()` guard) forces a fresh DB read via `disableCookieCache`,
    // so mutations stay authoritative and deactivation/role changes take effect
    // immediately on any write. View access is at most this stale.
    //
    // ⚠️ Contract: the future "deactivate user" action MUST revoke that user's
    // sessions (auth.api.revokeUserSessions / admin ban deletes session rows) so a
    // cached cookie can't outlive a disabled account beyond `maxAge` (docs/17 §3).
    // 60s: short enough that a deactivated user loses cached read access within a
    // minute (the revoke contract above + the deactivate dialog's promise), while
    // still serving the vast majority of renders from the cookie without a DB hit.
    cookieCache: { enabled: true, maxAge: 60 },
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
  // `nextCookies()` MUST be last: its `after` hook flushes Set-Cookie into the
  // Next.js cookie store, so cookie writes/refreshes (incl. the cookie cache)
  // commit correctly from Server Actions and RSC. Any plugin after it wouldn't be
  // flushed.
  plugins: [admin({ defaultRole: "ENGINEER", adminRoles: ["ADMIN"] }), nextCookies()],
});

export type Auth = typeof auth;

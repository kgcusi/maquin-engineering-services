import { cache } from "react";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";

// Server-side session reads. Both touch headers/cookies, so they are DYNAMIC —
// callers must stay out of `use cache` and live inside a <Suspense> boundary
// (docs/16 §7). The cookie cache (src/lib/auth.ts `session.cookieCache`) only
// removes the DB round-trip; it does NOT make these cacheable by Next.
//
// Each is wrapped in React `cache()` so repeated calls within a single
// render/request collapse to one — e.g. AuthGate and a page both calling
// `getSession()` cost one read, not two.

/**
 * Cheap READ path. Served from the signed cookie cache when valid (no DB hit),
 * falling back to a DB lookup only when the cookie cache is missing/expired.
 * Use for gating + read-only views (AuthGate). May be up to `cookieCache.maxAge`
 * (60s) stale for role/isActive — acceptable for viewing, never for mutations.
 * Returns null when unauthenticated.
 */
export const getSession = cache(async () => {
  try {
    return await auth.api.getSession({ headers: await headers() });
  } catch (error) {
    // Fail CLOSED, centrally: a session-read failure (e.g. DB unreachable) reads as
    // "not signed in" so callers redirect to /login — never crash the shell. Every
    // consumer (AuthGate, sidebar nav, user menu, page guards, login gate) inherits
    // this, so they don't each need their own try/catch.
    console.error("[getSession] read failed; treating as unauthenticated", error);
    return null;
  }
});

/**
 * Authoritative path. Forces a fresh DB read (`disableCookieCache`), so it
 * reflects revocation, deactivation, and role changes immediately. Use in the
 * `action()` mutation guard and any security-sensitive check.
 */
export const getFreshSession = cache(async () => {
  return auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });
});

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getSession>>>["user"];

type CurrentSession = Awaited<ReturnType<typeof getSession>>;

/**
 * The single source of truth for "this session may use the app": it exists AND
 * the account isn't deactivated. The AuthGate uses it to ALLOW access and the
 * login page uses its negation to redirect signed-in users away — sharing one
 * predicate is what guarantees the two can never disagree and loop.
 */
export function isAuthorized(session: CurrentSession): boolean {
  if (!session) return false;
  const u = session.user as { isActive?: boolean | null; banned?: boolean | null };
  // Deny both our domain flag (isActive=false) and Better Auth's admin-plugin ban.
  return u.isActive !== false && u.banned !== true;
}

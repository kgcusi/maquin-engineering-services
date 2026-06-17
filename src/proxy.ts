import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Next.js 16 Proxy (the renamed `middleware` convention — see
// node_modules/.../next/dist/docs/.../file-conventions/proxy.md). Runs before any
// route renders, on every matched request including prefetches.
//
// OPTIMISTIC, one-directional gate (no DB, no decrypt): if there is NO session
// cookie at all, send the request to /login before any RSC renders. That's the
// only thing it does.
//
// It deliberately does NOT redirect /login -> /dashboard. Cookie *presence* is not
// *validity* — a stale cookie (after a DB reset, an expired/revoked session, or a
// changed BETTER_AUTH_SECRET) is still "present". If the proxy treated presence as
// "logged in" it would bounce /login -> /dashboard while the authoritative AuthGate
// bounces /dashboard -> /login, looping forever (and locking you out of the login
// form). So validity is decided ONLY where the DB can be read:
//   • AuthGate (src/components/app-shell/auth-gate.tsx) — gates the (app) views
//   • action() (src/lib/rbac.ts) — re-validates every mutation
// A signed-in user who opens /login simply sees it and signs in again — harmless.

const PUBLIC_PATHS = new Set<string>(["/login"]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  if (getSessionCookie(request) == null) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Run on app routes only. Exclude the Better Auth handler (/api/auth/*) and any
  // other API routes, Next internals, and static assets (any path with a file
  // extension) — otherwise the cookie redirect would block CSS/JS/images and the
  // sign-in endpoint itself.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)"],
};

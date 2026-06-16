import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components (Next.js 16): PPR is the default render model — a static
  // shell streams immediately while dynamic content fills in. This app is
  // DYNAMIC BY DEFAULT (internal, auth-scoped, mutation-heavy). Caching is
  // opt-in via `use cache` + cacheTag/cacheLife, and reserved for the few
  // non-user-scoped, slow-changing reads: System Settings / lookup tables and
  // admin firm-wide report aggregates. Anything that reads the session
  // (cookies/headers) stays out of `use cache` and sits inside <Suspense>.
  // See docs/16-tech-decisions.md §7.
  cacheComponents: true,
  typedRoutes: true,
};

export default nextConfig;

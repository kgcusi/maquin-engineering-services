import { headers } from "next/headers";

import { auth } from "@/lib/auth";

// Server-side session read. This touches headers/cookies, so it is DYNAMIC —
// callers must stay out of `use cache` and live inside a <Suspense> boundary
// (docs/16 §7). Returns null when unauthenticated.
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getSession>>>["user"];

import { redirect } from "next/navigation";

import { getSession, isAuthorized } from "@/lib/session";

// Server-side authentication gate. Reads the session (dynamic — cookies/headers),
// so every consumer must render it inside a <Suspense> boundary (Cache
// Components rule). Fails CLOSED: any error (e.g. DB unreachable) is treated as
// unauthenticated. Uses the shared `isAuthorized` predicate — the same one the
// login page negates to bounce signed-in users — so they can never disagree and
// loop. Authorization (RBAC + project scope) layers on top of this.
export async function AuthGate({ children }: { children: React.ReactNode }) {
  let session: Awaited<ReturnType<typeof getSession>> = null;

  try {
    session = await getSession();
  } catch {
    session = null;
  }

  if (!isAuthorized(session)) {
    redirect("/login");
  }

  return <>{children}</>;
}

import { redirect } from "next/navigation";

import { getSession } from "@/lib/session";

// Server-side authentication gate. Reads the session (dynamic — cookies/headers),
// so every consumer must render it inside a <Suspense> boundary (Cache
// Components rule). Fails CLOSED: any error (e.g. DB unreachable) is treated as
// unauthenticated. Inactive accounts are denied (docs/17 §3). Authorization
// (RBAC + project scope) layers on top of this in Stage 1 (src/lib/rbac.ts).
export async function AuthGate({ children }: { children: React.ReactNode }) {
  let session: Awaited<ReturnType<typeof getSession>> = null;

  try {
    session = await getSession();
  } catch {
    session = null;
  }

  const user = session?.user as { isActive?: boolean } | undefined;
  if (!session || user?.isActive === false) {
    redirect("/login");
  }

  return <>{children}</>;
}

import { getSession } from "@/lib/session";

import { UserMenu } from "./user-menu";

function initialsOf(name: string, email: string): string {
  const source = name.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  const letters = parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : source.slice(0, 2) || "··";
  return letters.toUpperCase();
}

// Server slot: reads the CACHED session (deduped with AuthGate/SidebarNav via
// React cache) and renders the client menu. Streamed inside <Suspense> by the
// topbar so the chrome prerenders.
export async function UserMenuSlot() {
  const session = await getSession();
  const user = session?.user;
  if (!user) return null;

  const name = user.name ?? user.email ?? "User";
  const email = user.email ?? "";
  const role = (user as { role?: string | null }).role ?? null;

  return <UserMenu name={name} email={email} role={role} initials={initialsOf(name, email)} />;
}

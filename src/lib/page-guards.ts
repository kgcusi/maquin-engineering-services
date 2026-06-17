import { redirect } from "next/navigation";

import { hasPermission, type Permission } from "@/lib/rbac";
import { getSession } from "@/lib/session";

// Page-level RBAC gate. Reads the CACHED session (cheap read path) — the (app)
// layout's AuthGate already proved the user is authenticated + active; this only
// layers the permission check. Pass a single key or an array (ANY-of). Sends
// users who lack the permission back to their dashboard rather than throwing.
// Mutations are still re-checked authoritatively by the action() guard.
export async function requirePagePermission(permission: Permission | Permission[]) {
  const session = await getSession();
  if (!session) redirect("/login");

  const role = (session.user as { role?: string | null }).role ?? null;
  const keys = Array.isArray(permission) ? permission : [permission];
  if (!keys.some((key) => hasPermission(role, key))) redirect("/dashboard");

  return session;
}

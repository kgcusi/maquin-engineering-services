import { hasPermission } from "@/lib/rbac";
import { getSession } from "@/lib/session";

import { NAV_GROUPS } from "./nav";
import { NavLinks } from "./nav-links";

// Server-side permission filter for the nav. Reads the CACHED session (cheap),
// keeps only the live items the role may see (across every group), and hands the
// allowed hrefs to the client list. Streamed inside a <Suspense> by AppSidebar so
// the static shell still prerenders.
export async function SidebarNav() {
  const session = await getSession();
  const role = (session?.user as { role?: string | null } | undefined)?.role ?? null;

  const allowedHrefs = NAV_GROUPS.flatMap((group) => group.items)
    .filter((item) => {
      if (!item.live) return false;
      if (!item.requires) return true;
      const keys = Array.isArray(item.requires) ? item.requires : [item.requires];
      return keys.some((key) => hasPermission(role, key));
    })
    .map((item) => item.href);

  return <NavLinks allowedHrefs={allowedHrefs} />;
}

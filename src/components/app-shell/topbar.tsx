import { Suspense } from "react";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { MobileNav } from "./mobile-nav";
import { NotificationBell } from "./notification-bell";
import { SidebarBody } from "./sidebar-body";
import { UserMenuSlot } from "./user-menu-slot";

// Chrome is static so the shell prerenders instantly (Cache Components); only the
// session-aware account menu reads the session, so it streams inside <Suspense>.
// The mobile hamburger reuses the same server-rendered nav as the desktop sidebar.
// MobileNav reads usePathname() (dynamic — unknowable in a dynamic route's static
// shell), so it streams inside <Suspense> behind a static hamburger placeholder.
export function Topbar() {
  return (
    <header className="bg-background/80 sticky top-0 z-10 flex h-14 items-center gap-3 border-b px-4 backdrop-blur md:px-6">
      <Suspense fallback={<MobileNavFallback />}>
        <MobileNav>
          <SidebarBody />
        </MobileNav>
      </Suspense>
      <div className="flex-1" />
      <Suspense fallback={<Skeleton className="size-8 rounded-full" />}>
        <NotificationBell />
      </Suspense>
      <Suspense fallback={<Skeleton className="size-8 rounded-full" />}>
        <UserMenuSlot />
      </Suspense>
    </header>
  );
}

// Static stand-in for the streamed mobile hamburger — same footprint, no layout
// shift when MobileNav hydrates in.
function MobileNavFallback() {
  return (
    <Button variant="ghost" size="icon" aria-label="Open menu" className="md:hidden" disabled>
      <Menu className="size-5" />
    </Button>
  );
}

import { Suspense } from "react";

import { Brand } from "@/components/brand/brand";
import { Skeleton } from "@/components/ui/skeleton";

import { SidebarNav } from "./sidebar-nav";

// Shared shell content for the navigation: brand header + permission-filtered nav
// + footer. Rendered by the desktop <aside> (sidebar.tsx) and the mobile drawer
// (mobile-nav.tsx) so the nav stays single-source. Server component — the nav
// reads the session and streams inside <Suspense>.
export function SidebarBody() {
  return (
    <>
      <div className="flex h-14 shrink-0 items-center justify-center border-b px-4">
        <Brand variant="horizontal" priority className="h-10" />
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-3">
        <Suspense fallback={<NavSkeleton />}>
          <SidebarNav />
        </Suspense>
      </nav>

      <div className="text-muted-foreground shrink-0 border-t px-4 py-3 text-[11px]">v0.0.1</div>
    </>
  );
}

function NavSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-full" />
      <div className="space-y-1.5">
        <Skeleton className="ml-2.5 h-2.5 w-12" />
        <Skeleton className="h-7 w-full" />
        <Skeleton className="h-7 w-full" />
      </div>
    </div>
  );
}

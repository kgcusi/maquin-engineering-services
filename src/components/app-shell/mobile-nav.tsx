"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

// Mobile navigation: a hamburger (md:hidden) that opens the sidebar as a left
// drawer. The nav itself is the server-rendered <SidebarBody /> passed as
// children — same permission-filtered links as the desktop sidebar. Tapping a
// link changes the route, so we close the drawer whenever the pathname changes.
export function MobileNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Reset the drawer closed when navigation happens, by adjusting state during
  // render (the React-recommended alternative to a setState-in-effect).
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" aria-label="Open menu" className="md:hidden" />}
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="left" className="bg-sidebar text-sidebar-foreground gap-0 p-0">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        {children}
      </SheetContent>
    </Sheet>
  );
}

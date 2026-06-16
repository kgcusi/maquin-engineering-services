import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import { ModeToggle } from "./mode-toggle";

// Static chrome — intentionally no session read here so the shell prerenders
// instantly (Cache Components). A session-aware user menu can replace the
// placeholder avatar (inside its own <Suspense>) in a later stage.
export function Topbar() {
  return (
    <header className="bg-background/80 sticky top-0 z-10 flex h-14 items-center gap-4 border-b px-4 backdrop-blur md:px-6">
      <span className="font-semibold md:hidden">MAQUIN Engineering Services</span>
      <div className="flex-1" />
      <ModeToggle />
      <Avatar className="size-8 border">
        <AvatarFallback className="text-[11px] font-medium">··</AvatarFallback>
      </Avatar>
    </header>
  );
}

import { SidebarBody } from "./sidebar-body";

// Desktop sidebar: hidden below md, where navigation moves into the mobile drawer
// (see mobile-nav.tsx). The shared brand + nav + footer live in SidebarBody.
export function AppSidebar() {
  return (
    <aside className="bg-sidebar text-sidebar-foreground hidden w-60 shrink-0 flex-col border-r md:flex">
      <SidebarBody />
    </aside>
  );
}

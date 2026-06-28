import type { Route } from "next";
import {
  LayoutDashboard,
  FolderKanban,
  Boxes,
  Wallet,
  FileBarChart,
  Users,
  Building2,
  Truck,
  Contact,
  ScrollText,
  Settings,
  LayoutTemplate,
  ListChecks,
  type LucideIcon,
} from "lucide-react";

import type { Permission } from "@/lib/rbac";

export type NavItem = {
  title: string;
  href: Route;
  icon: LucideIcon;
  /** Permission(s) required to SEE this item (any-of). Omit = visible to all. */
  requires?: Permission | Permission[];
  /** Only items whose page actually exists render today; the rest are encoded
   *  so future modules slot into their group by flipping this to `true`. */
  live?: boolean;
};

export type NavGroup = {
  /** Section header; omit for the lead group (Dashboard) so it sits header-less. */
  label?: string;
  items: NavItem[];
};

// Grouped nav. Each module area is its own group so the sidebar scales as
// stages ship — for now only the live Setup pages (and Dashboard) surface; the
// not-yet-live entries stay hidden until their `live` flag flips.
export const NAV_GROUPS: NavGroup[] = [
  {
    items: [{ title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, live: true }],
  },
  {
    label: "Directory",
    items: [
      // `as Route`: the typed-routes union only refreshes on build; the cast keeps
      // typecheck green pre-build and is a no-op once the routes are generated.
      {
        title: "Clients",
        href: "/clients" as Route,
        icon: Building2,
        requires: "client.view",
        live: true,
      },
      {
        title: "Suppliers",
        href: "/suppliers" as Route,
        icon: Truck,
        requires: "supplier.view",
        live: true,
      },
      {
        title: "Employees",
        href: "/employees" as Route,
        icon: Contact,
        requires: "employee.view",
        live: true,
      },
    ],
  },
  {
    label: "Setup",
    items: [
      { title: "Users", href: "/users", icon: Users, requires: "user.view", live: true },
      { title: "Audit log", href: "/audit", icon: ScrollText, requires: "audit.view", live: true },
      {
        title: "Templates",
        href: "/templates" as Route,
        icon: LayoutTemplate,
        requires: "template.view",
        live: true,
      },
      {
        title: "Checklists",
        href: "/checklists" as Route,
        icon: ListChecks,
        requires: "checklist.view",
        live: true,
      },
      {
        title: "Settings",
        href: "/settings",
        icon: Settings,
        requires: "settings.view",
        live: true,
      },
    ],
  },
  {
    label: "Projects",
    items: [
      {
        title: "Projects",
        href: "/projects",
        icon: FolderKanban,
        // Admins (view.all) AND assigned engineers / QA-QC (view.assigned) see it.
        requires: ["project.view.all", "project.view.assigned"],
        live: true,
      },
    ],
  },
  {
    label: "Inventory",
    items: [{ title: "Inventory", href: "/inventory", icon: Boxes, requires: "item.view" }],
  },
  {
    label: "Finance",
    items: [{ title: "Finance", href: "/finance", icon: Wallet, requires: "budget.view" }],
  },
  {
    label: "Reports",
    items: [{ title: "Reports", href: "/reports", icon: FileBarChart, requires: "report.view" }],
  },
];

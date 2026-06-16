import type { Route } from "next";
import {
  LayoutDashboard,
  FolderKanban,
  Boxes,
  Wallet,
  FileBarChart,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: Route;
  icon: LucideIcon;
  /** The roadmap stage that lights this section up (placeholder until then). */
  stage?: string;
};

export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Projects", href: "/projects", icon: FolderKanban, stage: "S2" },
  { title: "Inventory", href: "/inventory", icon: Boxes, stage: "S3" },
  { title: "Finance", href: "/finance", icon: Wallet, stage: "S4" },
  { title: "Reports", href: "/reports", icon: FileBarChart, stage: "S5" },
  { title: "Settings", href: "/settings", icon: Settings, stage: "S1" },
];

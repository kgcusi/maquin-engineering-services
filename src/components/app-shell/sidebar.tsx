"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HardHat } from "lucide-react";

import { cn } from "@/lib/utils";

import { NAV_ITEMS } from "./nav";

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="bg-sidebar text-sidebar-foreground hidden w-64 shrink-0 flex-col border-r md:flex">
      <div className="flex h-14 items-center gap-2.5 border-b px-5">
        <span className="bg-sidebar-primary text-sidebar-primary-foreground flex size-8 items-center justify-center rounded-md">
          <HardHat className="size-4" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold">MAQUIN</p>
          <p className="text-muted-foreground text-[11px]">Engineering Services</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-primary/10 text-sidebar-primary font-medium"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1">{item.title}</span>
              {item.stage ? (
                <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-medium">
                  {item.stage}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="text-muted-foreground border-t p-4 text-[11px]">Stage 0 · Foundation</div>
    </aside>
  );
}

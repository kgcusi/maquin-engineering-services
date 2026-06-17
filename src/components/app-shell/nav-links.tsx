"use client";

import { usePathname } from "next/navigation";
import { Link } from "react-transition-progress/next";

import { cn } from "@/lib/utils";

import { NAV_GROUPS } from "./nav";

// Client list with grouped section headers and active-state styling. The SERVER
// decides WHICH items are visible (live + permission filter) and passes their
// hrefs — we can't ship the icon components across the RSC boundary, so we
// re-derive items from NAV_GROUPS here and drop any group left empty.
export function NavLinks({ allowedHrefs }: { allowedHrefs: string[] }) {
  const pathname = usePathname();
  const allowed = new Set(allowedHrefs);

  const groups = NAV_GROUPS.map((group) => ({
    label: group.label,
    items: group.items.filter((item) => allowed.has(item.href)),
  })).filter((group) => group.items.length > 0);

  // Only the most-specific match lights up — otherwise a parent route (e.g. a
  // future "/settings") would also highlight while on "/settings/users".
  const activeHref = groups
    .flatMap((group) => group.items)
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <div className="space-y-4">
      {groups.map((group, groupIndex) => (
        <div key={group.label ?? `group-${groupIndex}`} className="space-y-0.5">
          {group.label ? (
            <p className="text-muted-foreground/60 px-2.5 pb-1 text-[10px] font-medium tracking-wider uppercase">
              {group.label}
            </p>
          ) : null}
          {group.items.map((item) => {
            const active = item.href === activeHref;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                  active
                    ? "bg-sidebar-primary/10 text-sidebar-primary font-medium"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="flex-1">{item.title}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}

"use client";

import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useProgressTransition } from "@/hooks/use-progress-transition";

type Props = {
  page: number;
  total: number;
  pageSize: number;
  /** Query-string key to drive (default `page`). Detail panels namespace it,
   *  e.g. `docsPage` / `notesPage`, so two panels can page independently. */
  paramKey?: string;
  /** Drop the numbered page buttons (for the narrow detail-page panels). */
  compact?: boolean;
};

// Numbered page list with first/last always shown and an ellipsis across gaps:
// e.g. 1 … 4 5 6 … 12. One page on each side of the current page.
function pageItems(current: number, pageCount: number): (number | "ellipsis")[] {
  const items: (number | "ellipsis")[] = [];
  for (let p = 1; p <= pageCount; p++) {
    if (p === 1 || p === pageCount || (p >= current - 1 && p <= current + 1)) {
      items.push(p);
    } else if (items[items.length - 1] !== "ellipsis") {
      items.push("ellipsis");
    }
  }
  return items;
}

/**
 * Server-side pagination footer: "Showing X–Y of Z" + Prev/Next (and numbered
 * pages unless `compact`). Stays visible for any non-empty list — a single page
 * still renders with disabled controls so the footer's position is consistent
 * and users can see where paging will appear before the data outgrows one page.
 * Renders nothing only when the list is truly empty (`total === 0`); the
 * surrounding table/panel owns that empty state.
 */
export function TablePagination({
  page,
  total,
  pageSize,
  paramKey = "page",
  compact = false,
}: Props) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, start] = useProgressTransition();

  if (total === 0) return null;

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(page, 1), pageCount);
  const from = offsetStart(current, pageSize);
  const to = Math.min(current * pageSize, total);
  const canPrev = current > 1;
  const canNext = current < pageCount;

  function go(target: number) {
    const sp = new URLSearchParams(params.toString());
    if (target <= 1) sp.delete(paramKey);
    else sp.set(paramKey, String(target));
    const qs = sp.toString();
    start(() => {
      router.push((qs ? `${pathname}?${qs}` : pathname) as Route);
    });
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted-foreground text-sm">
        Showing{" "}
        <span className="text-foreground font-medium tabular-nums">
          {from}–{to}
        </span>{" "}
        of <span className="text-foreground font-medium tabular-nums">{total}</span>
      </p>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          disabled={!canPrev || isPending}
          onClick={() => go(current - 1)}
        >
          <ChevronLeft />
          Previous
        </Button>

        {!compact && (
          <div className="hidden items-center gap-1.5 sm:flex">
            {pageItems(current, pageCount).map((item, i) =>
              item === "ellipsis" ? (
                <span
                  key={`ellipsis-${i}`}
                  className="text-muted-foreground px-1 text-sm select-none"
                  aria-hidden
                >
                  …
                </span>
              ) : (
                <Button
                  key={item}
                  variant={item === current ? "default" : "outline"}
                  size="sm"
                  className="min-w-8 tabular-nums"
                  disabled={isPending}
                  aria-current={item === current ? "page" : undefined}
                  aria-label={`Page ${item}`}
                  onClick={() => go(item)}
                >
                  {item}
                </Button>
              ),
            )}
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          disabled={!canNext || isPending}
          onClick={() => go(current + 1)}
        >
          Next
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

function offsetStart(page: number, pageSize: number): number {
  return (page - 1) * pageSize + 1;
}

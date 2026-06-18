"use client";

import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useProgressTransition } from "@/hooks/use-progress-transition";

// Shared URL-state plumbing for the directory toolbar + table. Search and paging
// live in the query string (`?q=`, `?page=`); writes go through
// `useProgressTransition` so the global green top bar runs during the fetch and
// the controls can disable while it's in flight. Mirrors the audit table's
// `go()` (`src/components/audit/audit-table.tsx`), generalized for reuse.
export function useListQuery() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, start] = useProgressTransition();

  const q = params.get("q") ?? "";

  function navigate(mutate: (sp: URLSearchParams) => void) {
    const sp = new URLSearchParams(params.toString());
    mutate(sp);
    const qs = sp.toString();
    start(() => {
      router.push((qs ? `${pathname}?${qs}` : pathname) as Route);
    });
  }

  // A new search always resets to page 1 — the old offset is meaningless against
  // a different result set.
  function setSearch(term: string) {
    navigate((sp) => {
      const trimmed = term.trim();
      if (trimmed) sp.set("q", trimmed);
      else sp.delete("q");
      sp.delete("page");
    });
  }

  function clearSearch() {
    navigate((sp) => {
      sp.delete("q");
      sp.delete("page");
    });
  }

  return { q, isPending, setSearch, clearSearch };
}

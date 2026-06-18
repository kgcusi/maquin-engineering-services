"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useListQuery } from "./use-list-query";

type Props = {
  searchPlaceholder: string;
  searchLabel: string;
  newLabel: string;
  newIcon: ReactNode;
  onNew: () => void;
  /** Extra controls rendered to the left of the primary "New" button (e.g. Import). */
  actions?: ReactNode;
};

// Search + primary action row shared by every directory table. The input is
// controlled but debounced: keystrokes update local state instantly and only the
// settled value (~300ms) is pushed to `?q=`, so we navigate once per pause rather
// than once per character. Adopts external URL changes (e.g. the no-match "Clear
// search" action) without clobbering in-progress typing.
export function DirectoryToolbar({
  searchPlaceholder,
  searchLabel,
  newLabel,
  newIcon,
  onNew,
  actions,
}: Props) {
  const { q, isPending, setSearch } = useListQuery();
  const [value, setValue] = useState(q);
  const [lastQ, setLastQ] = useState(q);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Adopt an external URL change (e.g. the "Clear search" action) by adjusting
  // state during render rather than in an effect — the sanctioned pattern for
  // syncing state to a changed prop. In-progress typing is preserved because this
  // only fires when the settled `q` actually changes.
  if (q !== lastQ) {
    setLastQ(q);
    setValue(q);
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    setValue(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setSearch(next), 300);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full max-w-xs">
        {isPending ? (
          <Loader2 className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 animate-spin" />
        ) : (
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        )}
        <Input
          value={value}
          onChange={onChange}
          placeholder={searchPlaceholder}
          className="pl-8"
          aria-label={searchLabel}
        />
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <Button onClick={onNew} className="shrink-0">
          {newIcon}
          {newLabel}
        </Button>
      </div>
    </div>
  );
}

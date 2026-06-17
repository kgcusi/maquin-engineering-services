"use client";

import * as React from "react";
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";

import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, Search } from "lucide-react";

export type ComboboxItem = { value: string; label: string };

export type ComboboxProps = {
  items: ComboboxItem[];
  /** Currently selected value. */
  value: string | null;
  /** Fires on select. */
  onValueChange: (value: string | null) => void;
  /** Trigger text when nothing is selected. */
  placeholder?: string;
  /** Search input placeholder. */
  searchPlaceholder?: string;
  /** Shown when no items match the query. */
  emptyText?: string;
  disabled?: boolean;
  /** Applied to the trigger. */
  className?: string;
  "aria-label"?: string;
};

export function Combobox({
  items,
  value,
  onValueChange,
  placeholder,
  searchPlaceholder = "Search…",
  emptyText = "No results.",
  disabled,
  className,
  "aria-label": ariaLabel,
}: ComboboxProps): React.JSX.Element {
  const selectedItem = React.useMemo(
    () => items.find((item) => item.value === value) ?? null,
    [items, value],
  );

  return (
    <ComboboxPrimitive.Root<ComboboxItem, false>
      items={items}
      value={selectedItem}
      onValueChange={(next) => onValueChange(next?.value ?? null)}
      disabled={disabled}
    >
      <ComboboxPrimitive.Trigger
        data-slot="combobox-trigger"
        aria-label={ariaLabel}
        className={cn(
          "border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[placeholder]:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
          className,
        )}
      >
        <span className="line-clamp-1 flex flex-1 text-left">
          <ComboboxPrimitive.Value>
            {(item: ComboboxItem | null) => item?.label ?? placeholder}
          </ComboboxPrimitive.Value>
        </span>
        <ComboboxPrimitive.Icon
          render={<ChevronsUpDown className="text-muted-foreground pointer-events-none size-4" />}
        />
      </ComboboxPrimitive.Trigger>

      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner
          side="bottom"
          sideOffset={4}
          align="start"
          className="isolate z-50 outline-none"
        >
          <ComboboxPrimitive.Popup
            data-slot="combobox-content"
            className="bg-popover text-popover-foreground ring-foreground/10 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 relative isolate z-50 flex max-h-(--available-height) w-(--anchor-width) min-w-36 origin-(--transform-origin) flex-col overflow-hidden rounded-lg shadow-md ring-1 duration-100"
          >
            <div className="border-border relative border-b">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <ComboboxPrimitive.Input
                data-slot="combobox-input"
                placeholder={searchPlaceholder}
                className="placeholder:text-muted-foreground h-9 w-full bg-transparent py-1 pr-2.5 pl-8 text-sm outline-none"
              />
            </div>

            {/* Base UI keeps this element mounted as a live region, so it must
                not be `hidden`; instead collapse its padding to zero height when
                it has no children (i.e. when there ARE matching results). */}
            <ComboboxPrimitive.Empty className="text-muted-foreground px-2 text-center text-sm [&:not(:empty)]:py-6">
              {emptyText}
            </ComboboxPrimitive.Empty>

            <ComboboxPrimitive.List
              data-slot="combobox-list"
              className="scroll-py-1 overflow-x-hidden overflow-y-auto p-1 empty:hidden"
            >
              {(item: ComboboxItem) => (
                <ComboboxPrimitive.Item
                  key={item.value}
                  value={item}
                  data-slot="combobox-item"
                  className="data-highlighted:bg-accent data-highlighted:text-accent-foreground relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
                >
                  <span className="flex flex-1 shrink-0 gap-2 whitespace-nowrap">{item.label}</span>
                  <ComboboxPrimitive.ItemIndicator
                    render={
                      <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center" />
                    }
                  >
                    <Check className="pointer-events-none" />
                  </ComboboxPrimitive.ItemIndicator>
                </ComboboxPrimitive.Item>
              )}
            </ComboboxPrimitive.List>
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
  );
}

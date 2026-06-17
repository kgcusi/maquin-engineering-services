"use client";

import * as React from "react";
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";

export type CreatableComboboxProps = {
  /** Existing values to suggest; the list filters as you type. */
  options: string[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
};

// Free-text combobox: suggests + filters existing `options`, but the field value is
// whatever is typed — a NEW value is created just by typing it (no separate "add"
// step). For fields whose option set grows organically (e.g. Position). Distinct
// from <Combobox>, which is a strict select. Single source of truth = the input
// value (we don't track a separate selection).
export function CreatableCombobox({
  options,
  value,
  onValueChange,
  placeholder,
  emptyText = "No matches — your text is kept.",
  disabled,
  className,
  id,
  "aria-label": ariaLabel,
}: CreatableComboboxProps): React.JSX.Element {
  return (
    <ComboboxPrimitive.Root<string, false>
      items={options}
      inputValue={value}
      onInputValueChange={(next) => onValueChange(next)}
      disabled={disabled}
    >
      <div className="relative">
        <ComboboxPrimitive.Input
          id={id}
          aria-label={ariaLabel}
          placeholder={placeholder}
          className={cn(
            "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 h-8 w-full min-w-0 rounded-lg border bg-transparent py-1 pr-8 pl-2.5 text-base transition-colors outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            className,
          )}
        />
        <ComboboxPrimitive.Trigger
          aria-label="Show suggestions"
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-1.5 -translate-y-1/2 rounded-sm p-0.5 outline-none disabled:opacity-50"
        >
          <ComboboxPrimitive.Icon render={<ChevronsUpDown className="size-4" />} />
        </ComboboxPrimitive.Trigger>
      </div>

      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner
          side="bottom"
          sideOffset={4}
          align="start"
          className="isolate z-50 outline-none"
        >
          <ComboboxPrimitive.Popup className="bg-popover text-popover-foreground ring-foreground/10 data-[side=bottom]:slide-in-from-top-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-36 origin-(--transform-origin) overflow-y-auto rounded-lg p-1 shadow-md ring-1 duration-100">
            <ComboboxPrimitive.Empty className="text-muted-foreground px-2 text-center text-sm [&:not(:empty)]:py-3">
              {emptyText}
            </ComboboxPrimitive.Empty>
            <ComboboxPrimitive.List className="scroll-py-1 empty:hidden">
              {(item: string) => (
                <ComboboxPrimitive.Item
                  key={item}
                  value={item}
                  className="data-highlighted:bg-accent data-highlighted:text-accent-foreground relative flex w-full cursor-default items-center rounded-md px-1.5 py-1 text-sm outline-hidden select-none"
                >
                  {item}
                </ComboboxPrimitive.Item>
              )}
            </ComboboxPrimitive.List>
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
  );
}

"use client";

import { useMemo } from "react";
import { ChevronsUpDown, Users, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Option = { id: string; name: string };

// Multi-select for the project team's member engineers, built from existing
// primitives (no new dependency): a DropdownMenu of checkbox items for picking,
// plus a removable chip row for the current selection. The current lead is
// excluded from the option list so a person is never offered as both lead and a
// plain member (the server enforces this too via normalizeTeam).
export function EngineerMultiSelect({
  options,
  value,
  onChange,
  excludeId,
  disabled,
  id,
}: {
  options: Option[];
  value: string[];
  onChange: (next: string[]) => void;
  /** A user id to drop from the menu (the selected lead). */
  excludeId?: string | null;
  disabled?: boolean;
  id?: string;
}) {
  const selectable = useMemo(() => options.filter((o) => o.id !== excludeId), [options, excludeId]);
  const selected = useMemo(
    () => value.map((vid) => options.find((o) => o.id === vid)).filter((o): o is Option => !!o),
    [value, options],
  );

  function toggle(optionId: string, checked: boolean) {
    if (checked) onChange([...value, optionId]);
    else onChange(value.filter((vid) => vid !== optionId));
  }

  const count = selected.length;

  return (
    <div className="space-y-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              disabled={disabled || selectable.length === 0}
              className="h-8 w-full justify-between font-normal"
            />
          }
        >
          <span className={cn("flex items-center gap-1.5", count === 0 && "text-muted-foreground")}>
            <Users className="size-4" />
            {selectable.length === 0
              ? "No engineers available"
              : count === 0
                ? "Select team members"
                : `${count} engineer${count > 1 ? "s" : ""} selected`}
          </span>
          <ChevronsUpDown className="text-muted-foreground size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-72 w-(--anchor-width) overflow-y-auto">
          {selectable.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.id}
              checked={value.includes(option.id)}
              onCheckedChange={(checked) => toggle(option.id, checked)}
              closeOnClick={false}
            >
              {option.name}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {count > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {selected.map((option) => (
            <li key={option.id}>
              <Badge variant="secondary" className="gap-1 pr-1">
                {option.name}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => toggle(option.id, false)}
                  aria-label={`Remove ${option.name}`}
                  className="hover:text-foreground -mr-0.5 rounded-full p-0.5 transition-colors disabled:opacity-50"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

"use client";

import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxItem } from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { actionLabel, entityTypeLabel } from "@/modules/audit/labels";
import type { ActorOption } from "@/modules/audit/queries";

// Sentinel for the "no filter" option — Base UI controls need a non-empty value,
// so we can't use "" for "All".
const ALL = "__all";

type Props = {
  actors: ActorOption[];
  actions: string[];
  entityTypes: string[];
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  // Full-width (stacked) on phones; shrinks to its control's width from sm up.
  return (
    <div className="w-full space-y-1.5 sm:w-auto">
      <Label className="text-muted-foreground text-xs">{label}</Label>
      {children}
    </div>
  );
}

export function AuditFilters({ actors, actions, entityTypes }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // Any param other than the page cursor counts as an active filter.
  const hasFilters = [...params.keys()].some((key) => key !== "page");

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (!value || value === ALL) next.delete(key);
    else next.set(key, value);
    next.delete("page"); // any filter change resets to the first page
    const qs = next.toString();
    // Computed query strings can't be statically typed by typedRoutes.
    router.push((qs ? `${pathname}?${qs}` : pathname) as Route);
  }

  // Actor + action lists can grow large, so they get the searchable Combobox;
  // the handful of entity types stays a plain Select.
  const actorItems: ComboboxItem[] = [
    { value: ALL, label: "All actors" },
    ...actors.map((a) => ({ value: a.id, label: a.name })),
  ];
  const actionItems: ComboboxItem[] = [
    { value: ALL, label: "All actions" },
    ...actions.map((a) => ({ value: a, label: actionLabel(a) })),
  ];

  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Field label="Actor">
        <Combobox
          className="w-full sm:w-48"
          items={actorItems}
          value={params.get("actorId") ?? ALL}
          onValueChange={(v) => setParam("actorId", v)}
          placeholder="All actors"
          searchPlaceholder="Search actors…"
          emptyText="No actors found."
          aria-label="Filter by actor"
        />
      </Field>

      <Field label="Action">
        <Combobox
          className="w-full sm:w-52"
          items={actionItems}
          value={params.get("action") ?? ALL}
          onValueChange={(v) => setParam("action", v)}
          placeholder="All actions"
          searchPlaceholder="Search actions…"
          emptyText="No actions found."
          aria-label="Filter by action"
        />
      </Field>

      <Field label="Entity">
        <Select
          value={params.get("entityType") ?? ALL}
          onValueChange={(v) => setParam("entityType", v)}
        >
          <SelectTrigger className="w-full sm:w-40" aria-label="Filter by entity">
            <SelectValue>
              {(v: string | null) => (v && v !== ALL ? entityTypeLabel(v) : "All entities")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All entities</SelectItem>
            {entityTypes.map((e) => (
              <SelectItem key={e} value={e}>
                {entityTypeLabel(e)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="From">
        <DatePicker
          className="w-full sm:w-44"
          value={from}
          max={to || undefined}
          onChange={(v) => setParam("from", v)}
          placeholder="From date"
          aria-label="Filter from date"
        />
      </Field>

      <Field label="To">
        <DatePicker
          className="w-full sm:w-44"
          value={to}
          min={from || undefined}
          onChange={(v) => setParam("to", v)}
          placeholder="To date"
          aria-label="Filter to date"
        />
      </Field>

      {hasFilters && (
        <Button variant="ghost" onClick={() => router.push(pathname as Route)}>
          <X />
          Clear
        </Button>
      )}
    </div>
  );
}

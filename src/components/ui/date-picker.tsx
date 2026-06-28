"use client";

import * as React from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { Calendar as CalendarIcon, CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type DateFieldProps = {
  /** "" when empty; date = "YYYY-MM-DD"; datetime = "YYYY-MM-DDTHH:mm". */
  value: string;
  onChange: (value: string) => void;
  /** Inclusive bounds as "YYYY-MM-DD". */
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Applied to the trigger. */
  className?: string;
  "aria-label"?: string;
  id?: string;
};

// ── date helpers (local-time; avoids the UTC off-by-one of `new Date(string)`) ──
const pad = (n: number) => String(n).padStart(2, "0");
const toISODate = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

function parseISODate(s: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]) - 1;
  const d = Number(match[3]);
  const probe = new Date(y, m, d);
  if (probe.getFullYear() !== y || probe.getMonth() !== m || probe.getDate() !== d) return null;
  return { y, m, d };
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const monthNames = Array.from({ length: 12 }, (_, m) =>
  new Intl.DateTimeFormat(undefined, { month: "long" }).format(new Date(2000, m, 1)),
);
const dateFmt = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
});
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

function formatDisplay(value: string, withTime: boolean): string {
  const d = parseISODate(value);
  if (!d) return "";
  const label = dateFmt.format(new Date(d.y, d.m, d.d));
  if (!withTime) return label;
  const time = value.length >= 16 ? value.slice(11, 16) : "";
  if (!time) return label;
  const [hh, mm] = time.split(":").map(Number);
  return `${label} · ${timeFmt.format(new Date(d.y, d.m, d.d, hh, mm))}`;
}

// ── the month grid ──
function CalendarGrid({
  selected,
  onSelect,
  min,
  max,
}: {
  selected: string;
  onSelect: (iso: string) => void;
  min?: string;
  max?: string;
}) {
  const sel = parseISODate(selected);
  const now = new Date();
  const todayISO = toISODate(now.getFullYear(), now.getMonth(), now.getDate());

  const [view, setView] = React.useState(() => ({
    y: sel?.y ?? now.getFullYear(),
    m: sel?.m ?? now.getMonth(),
  }));

  const firstWeekday = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function shiftMonth(delta: number) {
    setView((v) => {
      const date = new Date(v.y, v.m + delta, 1);
      return { y: date.getFullYear(), m: date.getMonth() };
    });
  }

  const minYear = min ? Number(min.slice(0, 4)) : now.getFullYear() - 10;
  const maxYear = max ? Number(max.slice(0, 4)) : now.getFullYear() + 10;
  const lowYear = Math.min(minYear, view.y, sel?.y ?? view.y);
  const highYear = Math.max(maxYear, view.y, sel?.y ?? view.y);
  const years: number[] = [];
  for (let y = highYear; y >= lowYear; y--) years.push(y);

  const selectClass = cn(
    "hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring/50",
    "cursor-pointer appearance-none rounded-md bg-transparent py-1 pr-1 pl-1.5",
    "text-sm font-medium tabular-nums outline-none transition-colors focus-visible:ring-2",
  );

  return (
    <div className="w-64">
      <div className="flex items-center gap-1 pb-2">
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          aria-label="Previous month"
          onClick={() => shiftMonth(-1)}
        >
          <ChevronLeft />
        </Button>
        <div className="flex flex-1 items-center justify-center gap-0.5">
          <select
            aria-label="Month"
            value={view.m}
            onChange={(e) => setView((v) => ({ ...v, m: Number(e.target.value) }))}
            className={selectClass}
          >
            {monthNames.map((name, i) => (
              <option key={name} value={i}>
                {name}
              </option>
            ))}
          </select>
          <select
            aria-label="Year"
            value={view.y}
            onChange={(e) => setView((v) => ({ ...v, y: Number(e.target.value) }))}
            className={selectClass}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          aria-label="Next month"
          onClick={() => shiftMonth(1)}
        >
          <ChevronRight />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="text-muted-foreground flex h-8 items-center justify-center text-xs font-medium"
          >
            {w}
          </div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={`blank-${i}`} />;
          const iso = toISODate(view.y, view.m, d);
          const isSelected = iso === selected;
          const isToday = iso === todayISO;
          const disabled = (min != null && iso < min) || (max != null && iso > max);
          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              aria-pressed={isSelected}
              aria-current={isToday ? "date" : undefined}
              onClick={() => onSelect(iso)}
              className={cn(
                "focus-visible:ring-ring/50 flex size-8 items-center justify-center rounded-md text-sm tabular-nums transition-colors outline-none focus-visible:ring-2",
                "hover:bg-accent hover:text-accent-foreground",
                "disabled:pointer-events-none disabled:opacity-30",
                isToday && !isSelected && "text-primary font-semibold",
                isSelected &&
                  "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
              )}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type DateFieldInnerProps = DateFieldProps & {
  withTime: boolean;
  icon: React.ReactNode;
};

function DateField({
  withTime,
  icon,
  value,
  onChange,
  min,
  max,
  placeholder,
  disabled,
  className,
  "aria-label": ariaLabel,
  id,
}: DateFieldInnerProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);

  const datePart = value.slice(0, 10);
  const timePart = withTime && value.length >= 16 ? value.slice(11, 16) : "";
  const display = formatDisplay(value, withTime);

  const now = new Date();
  const todayISO = toISODate(now.getFullYear(), now.getMonth(), now.getDate());

  function commitDate(iso: string) {
    if (withTime) {
      onChange(`${iso}T${timePart || "00:00"}`);
    } else {
      onChange(iso);
      setOpen(false);
    }
  }

  function commitTime(time: string) {
    if (!time) return;
    onChange(`${datePart || todayISO}T${time}`);
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger
        id={id}
        disabled={disabled}
        aria-label={ariaLabel}
        data-slot={withTime ? "datetime-picker" : "date-picker"}
        className={cn(
          "border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-expanded:bg-muted/40 dark:bg-input/30 dark:hover:bg-input/50 flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border bg-transparent py-2 pr-2 pl-2.5 text-left text-sm transition-colors outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50",
          !display && "text-muted-foreground",
          className,
        )}
      >
        <span className="line-clamp-1">{display || placeholder}</span>
        {icon}
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          side="bottom"
          align="start"
          sideOffset={4}
          className="isolate z-50 outline-none"
        >
          <PopoverPrimitive.Popup
            data-slot="date-picker-content"
            className="bg-popover text-popover-foreground ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 origin-(--transform-origin) rounded-lg p-3 shadow-md ring-1 duration-100 outline-none"
          >
            <CalendarGrid selected={datePart} onSelect={commitDate} min={min} max={max} />

            {withTime && (
              <div className="mt-2 flex items-center gap-2 border-t pt-2">
                <span className="text-muted-foreground text-xs">Time</span>
                <input
                  type="time"
                  value={timePart}
                  onChange={(e) => commitTime(e.target.value)}
                  className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-7 flex-1 rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:ring-3"
                />
              </div>
            )}

            <div className="mt-2 flex items-center justify-between border-t pt-2">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                Clear
              </Button>
              <Button variant="ghost" size="sm" type="button" onClick={() => commitDate(todayISO)}>
                Today
              </Button>
            </div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

export function DatePicker(props: DateFieldProps): React.JSX.Element {
  return (
    <DateField
      withTime={false}
      icon={<CalendarIcon className="text-muted-foreground size-4 shrink-0" />}
      placeholder={props.placeholder ?? "Select date"}
      {...props}
    />
  );
}

export function DateTimePicker(props: DateFieldProps): React.JSX.Element {
  return (
    <DateField
      withTime
      icon={<CalendarClock className="text-muted-foreground size-4 shrink-0" />}
      placeholder={props.placeholder ?? "Select date & time"}
      {...props}
    />
  );
}

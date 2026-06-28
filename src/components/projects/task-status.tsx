import { CalendarRange, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  deriveTaskStatus,
  taskStatusLabel,
  type ProgressStatus,
  type TaskStatus,
} from "@/lib/statuses";
import { cn } from "@/lib/utils";

// Single source of truth for task/phase status colour. The static badge, the
// interactive status control (task-progress-control), and the legend all read
// from here so the palette can never drift between them.
export const PROGRESS_STATUS_TONE: Record<ProgressStatus, string> = {
  NOT_STARTED: "border-border text-muted-foreground",
  IN_PROGRESS: "border-primary/30 bg-primary/10 text-primary",
  DONE: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/30 dark:text-emerald-400",
};

export const BLOCKED_TONE =
  "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:border-amber-400/30 dark:text-amber-400";
export const DELAYED_TONE = "border-destructive/40 bg-destructive/10 text-destructive";

// Blocked is a status value now, so it carries its own tone alongside the three
// progress statuses. Delayed stays a separate overlay badge (it's derived, not set).
export const TASK_STATUS_TONE: Record<TaskStatus, string> = {
  NOT_STARTED: PROGRESS_STATUS_TONE.NOT_STARTED,
  IN_PROGRESS: PROGRESS_STATUS_TONE.IN_PROGRESS,
  BLOCKED: BLOCKED_TONE,
  DONE: PROGRESS_STATUS_TONE.DONE,
};

// Static (read-only) task status pill — used when the viewer can't set status.
// Blocked shows the warning glyph; the reason is rendered inline beneath the task.
export function TaskStatusBadge({
  pct,
  isBlocked,
  className,
}: {
  pct: number;
  isBlocked: boolean;
  className?: string;
}) {
  const status = deriveTaskStatus(pct, isBlocked);
  return (
    <Badge
      variant="outline"
      className={cn("gap-1 font-medium", TASK_STATUS_TONE[status], className)}
    >
      {status === "BLOCKED" ? <TriangleAlert className="size-3" /> : null}
      {taskStatusLabel(status)}
    </Badge>
  );
}

export function DelayedBadge() {
  return (
    <Badge variant="destructive" className="gap-1">
      <CalendarRange className="size-3" /> Delayed
    </Badge>
  );
}

// Key for the status colours used across the tab. Reads from the same tone tokens
// as the badges above, so a colour change in one place updates the legend too.
const LEGEND_ITEMS: { label: string; tone: string }[] = [
  { label: "Not started", tone: TASK_STATUS_TONE.NOT_STARTED },
  { label: "In progress", tone: TASK_STATUS_TONE.IN_PROGRESS },
  { label: "Blocked", tone: TASK_STATUS_TONE.BLOCKED },
  { label: "Done", tone: TASK_STATUS_TONE.DONE },
  { label: "Delayed", tone: DELAYED_TONE },
];

export function TaskStatusLegend({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1.5", className)}>
      <span className="text-muted-foreground/80 text-xs font-medium tracking-wide uppercase">
        Status
      </span>
      {LEGEND_ITEMS.map((item) => (
        <span
          key={item.label}
          className="text-muted-foreground inline-flex items-center gap-1.5 text-xs"
        >
          <span className={cn("size-2.5 rounded-full border", item.tone)} aria-hidden />
          {item.label}
        </span>
      ))}
    </div>
  );
}

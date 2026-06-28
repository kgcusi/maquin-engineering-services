import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type KpiTone = "default" | "warning" | "danger";

const CHIP: Record<KpiTone, string> = {
  default: "bg-primary/10 text-primary ring-primary/15",
  warning: "bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400",
  danger: "bg-destructive/10 text-destructive ring-destructive/20",
};

// A non-zero count on a risk tile (overdue/blocked/at-risk) earns a colored number
// so the eye lands on what needs attention; zero stays calm and neutral.
const ACTIVE_VALUE: Record<KpiTone, string> = {
  default: "text-foreground",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-destructive",
};

export function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone?: KpiTone;
}) {
  const accent = tone !== "default" && value > 0;
  return (
    <div className="bg-card ring-foreground/10 flex items-center gap-3 rounded-xl p-4 ring-1">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg ring-1",
          CHIP[tone],
        )}
      >
        <Icon className="size-5" strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <div
          className={cn(
            "text-2xl font-semibold tracking-tight tabular-nums",
            accent ? ACTIVE_VALUE[tone] : "text-foreground",
          )}
        >
          {value}
        </div>
        <div className="text-muted-foreground truncate text-xs font-medium">{label}</div>
      </div>
    </div>
  );
}

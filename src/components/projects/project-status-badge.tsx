import { Badge } from "@/components/ui/badge";
import { projectStatusLabel, type ProjectStatus } from "@/lib/statuses";

// Project lifecycle pill. A restrained, on-brand mapping (no emoji): Active reads
// as the primary in-progress state, On Hold as a cautionary amber, Completed as a
// settled muted tone, Cancelled as a subdued destructive, Planning as a neutral
// outline. Shares spellings with `@/lib/statuses` so the label can't drift.
const VARIANTS: Record<
  ProjectStatus,
  { variant: "default" | "secondary" | "outline" | "destructive"; className?: string }
> = {
  PLANNING: { variant: "outline" },
  ACTIVE: { variant: "default" },
  ON_HOLD: {
    variant: "outline",
    className:
      "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 dark:border-amber-400/30",
  },
  COMPLETED: { variant: "secondary" },
  CANCELLED: { variant: "destructive" },
};

// Outlined tone used by the *interactive* status pill (project-status-control) and
// its menu dots — the static badge above keeps its solid Badge variants. Kept here
// so the two project-status colour sources live side by side and stay in step.
export const PROJECT_STATUS_TONE: Record<ProjectStatus, string> = {
  PLANNING: "border-border text-muted-foreground",
  ACTIVE: "border-primary/30 bg-primary/10 text-primary",
  ON_HOLD:
    "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:border-amber-400/30 dark:text-amber-400",
  COMPLETED: "border-border bg-muted text-muted-foreground",
  CANCELLED: "border-destructive/40 bg-destructive/10 text-destructive",
};

export function ProjectStatusBadge({ status }: { status: string }) {
  const config = VARIANTS[status as ProjectStatus] ?? { variant: "outline" as const };
  return (
    <Badge variant={config.variant} className={config.className}>
      {projectStatusLabel(status)}
    </Badge>
  );
}

import type { Route } from "next";
import { Link } from "react-transition-progress/next";

import { ProgressMeter } from "@/components/projects/progress-meter";
import { ProjectStatusBadge } from "@/components/projects/project-status-badge";
import type { DashboardProjectRow } from "@/modules/dashboard/domain";
import { cn } from "@/lib/utils";

function CountChip({ tone, children }: { tone: "danger" | "warning"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ring-1",
        tone === "danger"
          ? "bg-destructive/10 text-destructive ring-destructive/20"
          : "bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-400",
      )}
    >
      {children}
    </span>
  );
}

/** Shared project row for both the engineer's "My projects" and the admin's
 *  "Needs attention" lists. Each row deep-links to the project hub. */
export function DashboardProjectList({ rows }: { rows: DashboardProjectRow[] }) {
  return (
    <ul className="divide-border/70 divide-y">
      {rows.map((p) => (
        <li key={p.id}>
          <Link
            href={`/projects/${p.id}` as Route}
            className="hover:bg-accent/40 -mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{p.name}</span>
                <ProjectStatusBadge status={p.status} />
              </div>
              <span className="text-muted-foreground font-mono text-xs tracking-tight">
                {p.refCode}
              </span>
            </div>

            <div className="hidden sm:block">
              <ProgressMeter pct={p.progressPct} />
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {p.overdueTasks > 0 ? (
                <CountChip tone="danger">{p.overdueTasks} overdue</CountChip>
              ) : null}
              {p.blockedTasks > 0 ? (
                <CountChip tone="warning">{p.blockedTasks} blocked</CountChip>
              ) : null}
              {p.openTasks > 0 && p.overdueTasks === 0 && p.blockedTasks === 0 ? (
                <span className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
                  {p.openTasks} open
                </span>
              ) : null}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

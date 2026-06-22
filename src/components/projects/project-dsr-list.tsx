"use client";

import { useRouter } from "next/navigation";
import { Link } from "react-transition-progress/next";
import type { Route } from "next";
import { CalendarClock, ChevronRight, ClipboardList, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { DsrStatusBadge } from "@/components/projects/dsr-status-badge";
import { TablePagination } from "@/components/directory/table-pagination";
import { Button } from "@/components/ui/button";
import { useProgressTransition } from "@/hooks/use-progress-transition";
import { formatDateTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { resolveTodayDsrAction } from "@/modules/projects/dsr/actions";
import type { DsrListRow } from "@/modules/projects/dsr/queries";
import type { Paginated } from "@/modules/shared/list-params";

function reportDate(iso: string, timeZone: string): string {
  return formatDateTime(`${iso}T00:00:00`, timeZone, "date");
}

// "Start / resume today's report" — collision-safe on the server: returns today's
// existing row or creates a fresh DRAFT, then routes to the editor. Disabled in
// flight so a double-tap can't fire two resolves.
function StartTodayButton({
  projectId,
  size = "default",
}: {
  projectId: string;
  size?: "default" | "sm";
}) {
  const router = useRouter();
  const [isPending, start] = useProgressTransition();

  function go() {
    start(async () => {
      const result = await resolveTodayDsrAction({ projectId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push(`/projects/${projectId}/dsr/${result.data.id}` as Route);
    });
  }

  return (
    <Button size={size} onClick={go} disabled={isPending}>
      {isPending ? (
        <>
          <Loader2 className="animate-spin" /> Opening…
        </>
      ) : (
        <>
          <Plus /> Start today&apos;s report
        </>
      )}
    </Button>
  );
}

export function ProjectDsrList({
  projectId,
  reports,
  timeZone,
  canCreate,
}: {
  projectId: string;
  reports: Paginated<DsrListRow>;
  timeZone: string;
  canCreate: boolean;
}) {
  if (reports.total === 0) {
    return (
      <div className="flex max-w-2xl flex-col items-center gap-3 rounded-lg border border-dashed py-14 text-center">
        <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full">
          <ClipboardList className="size-5" />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-medium">No daily reports yet</p>
          <p className="text-muted-foreground mx-auto max-w-sm text-sm">
            {canCreate
              ? "File the day's manpower, weather, and site issues. Start a report and it autosaves as you go."
              : "When the site team files daily reports — manpower, weather, and issues — they'll appear here."}
          </p>
        </div>
        {canCreate ? (
          <div className="mt-1">
            <StartTodayButton projectId={projectId} />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-4">
      {canCreate ? (
        <div className="flex justify-end">
          <StartTodayButton projectId={projectId} size="sm" />
        </div>
      ) : null}

      <ul className="divide-border divide-y overflow-hidden rounded-lg border">
        {reports.rows.map((dsr) => {
          const submitted = dsr.status === "SUBMITTED";
          return (
            <li key={dsr.id}>
              <Link
                href={`/projects/${projectId}/dsr/${dsr.id}` as Route}
                className="hover:bg-muted/40 group flex items-center gap-3 px-4 py-3 transition-colors"
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-md",
                    submitted
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <ClipboardList className="size-4" />
                </span>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium tabular-nums">
                      {reportDate(dsr.reportDate, timeZone)}
                    </span>
                    <DsrStatusBadge status={dsr.status} />
                    <span className="text-muted-foreground font-mono text-xs tracking-tight">
                      {dsr.refCode}
                    </span>
                  </div>
                  <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    {submitted && dsr.submittedByName ? (
                      <>
                        <span>{dsr.submittedByName}</span>
                        {dsr.submittedAt ? (
                          <>
                            <span aria-hidden>·</span>
                            <span className="tabular-nums">
                              {formatDateTime(dsr.submittedAt, timeZone, "datetime")}
                            </span>
                          </>
                        ) : null}
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarClock className="size-3.5 shrink-0" />
                        Working draft — not yet submitted
                      </span>
                    )}
                  </p>
                </div>

                <ChevronRight className="text-muted-foreground/60 group-hover:text-foreground size-4 shrink-0 transition-colors" />
              </Link>
            </li>
          );
        })}
      </ul>

      <TablePagination
        compact
        page={reports.page}
        total={reports.total}
        pageSize={reports.pageSize}
        paramKey="dsrPage"
      />
    </div>
  );
}

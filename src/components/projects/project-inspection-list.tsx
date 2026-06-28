"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  ChevronDown,
  ClipboardCheck,
  History,
  ImageIcon,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { InspectionFormDialog } from "@/components/projects/inspection-form-dialog";
import { InspectionOutcomeDialog } from "@/components/projects/inspection-outcome-dialog";
import { InspectionStatusBadge } from "@/components/projects/inspection-status-badge";
import { TablePagination } from "@/components/directory/table-pagination";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useProgressTransition } from "@/hooks/use-progress-transition";
import { formatDateTime } from "@/lib/datetime";
import { inspectionItemResultLabel, type InspectionItemResult } from "@/lib/statuses";
import { cn } from "@/lib/utils";
import {
  deleteInspectionAction,
  getInspectionAttemptsAction,
  getInspectionPhotoUrlAction,
} from "@/modules/projects/inspections/actions";
import type {
  InspectionAttemptView,
  InspectionListRow,
} from "@/modules/projects/inspections/queries";
import type { Paginated } from "@/modules/shared/list-params";

type Option = { id: string; name: string };

function scheduledLabel(iso: string, timeZone: string): string {
  return formatDateTime(`${iso}T00:00:00`, timeZone, "date");
}

export function ProjectInspectionList({
  projectId,
  inspections,
  timeZone,
  canRequest,
  canRecord,
  canRecordAny,
  viewerId,
  inspectors,
}: {
  projectId: string;
  inspections: Paginated<InspectionListRow>;
  timeZone: string;
  canRequest: boolean;
  canRecord: boolean;
  canRecordAny: boolean;
  viewerId: string;
  inspectors: Option[];
}) {
  const [requestOpen, setRequestOpen] = useState(false);
  const [recordTarget, setRecordTarget] = useState<InspectionListRow | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<InspectionListRow | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const requestDialog = canRequest ? (
    <InspectionFormDialog
      open={requestOpen}
      onOpenChange={setRequestOpen}
      projectId={projectId}
      inspectors={inspectors}
    />
  ) : null;

  if (inspections.total === 0) {
    return (
      <>
        <div className="flex max-w-2xl flex-col items-center gap-3 rounded-lg border border-dashed py-14 text-center">
          <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full">
            <ClipboardCheck className="size-5" />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-medium">No inspections yet</p>
            <p className="text-muted-foreground mx-auto max-w-sm text-sm">
              {canRequest
                ? "Ask a QA/QC engineer to check the work — a pour, a rebar layout, a finished system. They’re notified and record a pass or fail."
                : "When the site team requests QA/QC inspections, they’ll appear here with their outcomes."}
            </p>
          </div>
          {canRequest ? (
            <Button className="mt-1" onClick={() => setRequestOpen(true)}>
              <Plus /> Request inspection
            </Button>
          ) : null}
        </div>
        {requestDialog}
      </>
    );
  }

  return (
    <div className="max-w-3xl space-y-4">
      {canRequest ? (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setRequestOpen(true)}>
            <Plus /> Request inspection
          </Button>
        </div>
      ) : null}

      <ul className="divide-border divide-y overflow-hidden rounded-lg border">
        {inspections.rows.map((row) => {
          const open = row.status === "REQUESTED";
          const recorded = row.status === "PASSED" || row.status === "FAILED";
          const canActOnRow = canRecord && (row.inspectorId === viewerId || canRecordAny);
          const showRecord = open && canActOnRow;
          const showReinspect = recorded && canActOnRow;
          const showWithdraw = open && (row.requestedById === viewerId || canRecordAny);
          const isExpanded = expanded === row.id;
          return (
            <li key={row.id} className="flex flex-col gap-2 px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{row.title}</span>
                    <InspectionStatusBadge status={row.status} />
                    <span className="text-muted-foreground font-mono text-xs tracking-tight">
                      {row.refCode}
                    </span>
                  </div>
                  <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className="inline-flex items-center gap-1.5">
                      <ShieldCheck className="size-3.5 shrink-0" />
                      {row.inspectorName ?? "Unassigned"}
                    </span>
                    {row.area ? (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="size-3.5 shrink-0" />
                        {row.area}
                      </span>
                    ) : null}
                    {open && row.scheduledFor ? (
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarClock className="size-3.5 shrink-0" />
                        {scheduledLabel(row.scheduledFor, timeZone)}
                      </span>
                    ) : null}
                    {!open && row.inspectedAt ? (
                      <span className="tabular-nums">
                        {formatDateTime(row.inspectedAt, timeZone, "datetime")}
                      </span>
                    ) : null}
                  </p>
                  {row.requestedByName ? (
                    <p className="text-muted-foreground text-xs">
                      Requested by {row.requestedByName}
                    </p>
                  ) : null}
                  {row.description ? (
                    <p className="text-foreground/80 text-xs">{row.description}</p>
                  ) : null}
                  {!open && row.outcomeRemarks?.trim() ? (
                    <p
                      className={
                        row.status === "FAILED"
                          ? "flex items-start gap-1.5 text-xs text-red-700 dark:text-red-400"
                          : "text-muted-foreground text-xs"
                      }
                    >
                      {row.status === "FAILED" ? (
                        <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                      ) : null}
                      <span>{row.outcomeRemarks}</span>
                    </p>
                  ) : null}
                </div>

                {showRecord || showReinspect || showWithdraw ? (
                  <div className="flex shrink-0 items-center gap-1.5">
                    {showRecord ? (
                      <Button size="sm" variant="outline" onClick={() => setRecordTarget(row)}>
                        Record outcome
                      </Button>
                    ) : null}
                    {showReinspect ? (
                      <Button size="sm" variant="outline" onClick={() => setRecordTarget(row)}>
                        <RefreshCw className="size-3.5" /> Re-inspect
                      </Button>
                    ) : null}
                    {showWithdraw ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Withdraw inspection"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setWithdrawTarget(row)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="flex items-center">
                <Button
                  size="xs"
                  variant="ghost"
                  className="text-muted-foreground -ml-1.5"
                  aria-expanded={isExpanded}
                  onClick={() => setExpanded(isExpanded ? null : row.id)}
                >
                  <History className="size-3.5" />
                  {isExpanded ? "Hide history" : "View history"}
                  <ChevronDown
                    className={cn("size-3.5 transition-transform", isExpanded ? "rotate-180" : "")}
                  />
                </Button>
              </div>

              {isExpanded ? <InspectionHistory inspectionId={row.id} timeZone={timeZone} /> : null}
            </li>
          );
        })}
      </ul>

      <TablePagination
        compact
        page={inspections.page}
        total={inspections.total}
        pageSize={inspections.pageSize}
        paramKey="inspPage"
      />

      {requestDialog}
      <InspectionOutcomeDialog
        inspection={recordTarget}
        onOpenChange={(o) => {
          if (!o) setRecordTarget(null);
        }}
      />
      <WithdrawDialog target={withdrawTarget} onClose={() => setWithdrawTarget(null)} />
    </div>
  );
}

type HistoryState =
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "ready"; attempts: InspectionAttemptView[] };

function InspectionHistory({ inspectionId, timeZone }: { inspectionId: string; timeZone: string }) {
  // Mounts fresh each time a row is expanded, so the initial "loading" state stands —
  // the effect only setStates from its async callbacks (avoids set-state-in-effect).
  const [state, setState] = useState<HistoryState>({ phase: "loading" });

  useEffect(() => {
    let active = true;
    getInspectionAttemptsAction({ inspectionId })
      .then((res) => {
        if (!active) return;
        if (!res.ok) {
          toast.error(res.error);
          setState({ phase: "error" });
          return;
        }
        setState({ phase: "ready", attempts: res.data });
      })
      .catch(() => {
        if (active) setState({ phase: "error" });
      });
    return () => {
      active = false;
    };
  }, [inspectionId]);

  if (state.phase === "loading") {
    return (
      <div className="text-muted-foreground flex items-center gap-2 rounded-lg border border-dashed px-3 py-5 text-xs">
        <Loader2 className="size-3.5 animate-spin" /> Loading history…
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-5 text-center text-xs">
        Couldn&apos;t load the attempt history.
      </p>
    );
  }

  if (state.attempts.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-5 text-center text-xs">
        No recorded attempts yet.
      </p>
    );
  }

  return (
    <ol className="border-border/70 ml-1 space-y-3 border-l pl-4">
      {state.attempts.map((attempt) => (
        <AttemptCard
          key={attempt.id}
          inspectionId={inspectionId}
          attempt={attempt}
          timeZone={timeZone}
        />
      ))}
    </ol>
  );
}

const ITEM_PILL: Record<InspectionItemResult, string> = {
  PASS: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  FAIL: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400",
  NA: "border-border bg-muted text-muted-foreground",
};

function AttemptCard({
  inspectionId,
  attempt,
  timeZone,
}: {
  inspectionId: string;
  attempt: InspectionAttemptView;
  timeZone: string;
}) {
  return (
    <li className="bg-card relative rounded-xl border p-3">
      <span className="bg-border absolute top-4 -left-[1.3125rem] size-2 rounded-full ring-2 ring-[var(--card)]" />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold tabular-nums">Attempt {attempt.attemptNo}</span>
        <InspectionStatusBadge status={attempt.outcome} />
        <span className="text-muted-foreground text-xs tabular-nums">
          {formatDateTime(attempt.recordedAt, timeZone, "datetime")}
        </span>
        {attempt.recordedByName ? (
          <span className="text-muted-foreground text-xs">by {attempt.recordedByName}</span>
        ) : null}
      </div>

      {attempt.remarks?.trim() ? (
        <p
          className={cn(
            "mt-1.5 text-xs",
            attempt.outcome === "FAILED" ? "text-red-700 dark:text-red-400" : "text-foreground/80",
          )}
        >
          {attempt.remarks}
        </p>
      ) : null}

      {attempt.items.length > 0 ? (
        <ul className="mt-2.5 space-y-2">
          {attempt.items.map((item) => {
            const pill =
              ITEM_PILL[item.result as InspectionItemResult] ??
              "border-border bg-muted text-muted-foreground";
            return (
              <li
                key={item.id}
                className="border-border/60 border-t pt-2 first:border-t-0 first:pt-0"
              >
                <div className="flex items-start gap-2">
                  <span
                    className={cn(
                      "mt-px inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[0.65rem] font-medium",
                      pill,
                    )}
                  >
                    {inspectionItemResultLabel(item.result)}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-foreground/90 text-xs leading-snug">{item.label}</p>
                    {item.remarks?.trim() ? (
                      <p className="text-muted-foreground text-xs">{item.remarks}</p>
                    ) : null}
                    {item.photos.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {item.photos.map((photo) => (
                          <ItemPhotoButton
                            key={photo.attachmentId}
                            inspectionId={inspectionId}
                            resultId={item.id}
                            attachmentId={photo.attachmentId}
                            filename={photo.filename}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </li>
  );
}

function ItemPhotoButton({
  inspectionId,
  resultId,
  attachmentId,
  filename,
}: {
  inspectionId: string;
  resultId: string;
  attachmentId: string;
  filename: string;
}) {
  const [isPending, start] = useProgressTransition();

  function open() {
    start(async () => {
      const res = await getInspectionPhotoUrlAction({ inspectionId, resultId, attachmentId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      window.open(res.data.url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={isPending}
      className="bg-muted/60 hover:bg-muted inline-flex max-w-44 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[0.7rem] transition-colors disabled:opacity-50"
    >
      {isPending ? (
        <Loader2 className="size-3 shrink-0 animate-spin" />
      ) : (
        <ImageIcon className="size-3 shrink-0" />
      )}
      <span className="truncate">{filename}</span>
    </button>
  );
}

function WithdrawDialog({
  target,
  onClose,
}: {
  target: InspectionListRow | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, start] = useProgressTransition();

  function confirm() {
    if (!target) return;
    start(async () => {
      const result = await deleteInspectionAction({ id: target.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Inspection withdrawn.");
      onClose();
      router.refresh();
    });
  }

  return (
    <AlertDialog
      open={target !== null}
      onOpenChange={(o) => {
        if (!o && !isPending) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Withdraw this inspection?</AlertDialogTitle>
          <AlertDialogDescription>
            {target ? (
              <>
                “{target.title}” ({target.refCode}) will be removed. The inspector keeps project
                access. This can&apos;t be undone.
              </>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Keep it</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={confirm} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Withdrawing…
              </>
            ) : (
              "Withdraw"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

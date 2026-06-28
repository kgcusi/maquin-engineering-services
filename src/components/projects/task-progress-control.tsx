"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { Check, ChevronDown, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { TASK_STATUS_TONE } from "@/components/projects/task-status";
import { badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { useProgressTransition } from "@/hooks/use-progress-transition";
import { TASK_STATUSES, deriveTaskStatus, taskStatusLabel, type TaskStatus } from "@/lib/statuses";
import { cn } from "@/lib/utils";
import { updateTaskStatusAction } from "@/modules/projects/tasks/actions";

const todayISO = () => new Date().toISOString().slice(0, 10);

// The status pill IS the control: click it and pick Not started / In progress /
// Blocked / Done. "Not started" saves in one click; "In progress" and "Done" first
// prompt for the actual start / completion date (defaults to today, editable —
// actuals are manual), and Blocked opens a required reason field (the lead is
// notified when it saves). Status maps to the stored progress (0 / 50 / 100)
// underneath; Blocked keeps the current progress. The server re-checks
// authorization — any {ok:false} surfaces as a toast.
export function TaskProgressControl({
  taskId,
  taskName,
  progressPct,
  isBlocked,
  blockedReason,
}: {
  taskId: string;
  taskName: string;
  progressPct: number;
  isBlocked: boolean;
  blockedReason: string | null;
}) {
  const router = useRouter();
  const [isPending, start] = useProgressTransition();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"menu" | "block" | "startDate" | "endDate">("menu");
  const [reason, setReason] = useState(blockedReason ?? "");
  const [actualDate, setActualDate] = useState(todayISO());

  const current = deriveTaskStatus(progressPct, isBlocked);

  function resetToMenu() {
    setMode("menu");
    setReason(blockedReason ?? "");
    setActualDate(todayISO());
  }

  function save(
    status: TaskStatus,
    opts?: { blockReason?: string; actualStartDate?: string; actualEndDate?: string },
  ) {
    start(async () => {
      const result = await updateTaskStatusAction({
        id: taskId,
        status,
        blockedReason: status === "BLOCKED" ? opts?.blockReason : undefined,
        actualStartDate: status === "IN_PROGRESS" ? opts?.actualStartDate : undefined,
        actualEndDate: status === "DONE" ? opts?.actualEndDate : undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${taskName}: ${taskStatusLabel(status).toLowerCase()}.`);
      setOpen(false);
      router.refresh();
    });
  }

  function choose(status: TaskStatus) {
    if (status === "BLOCKED") {
      setMode("block");
      return;
    }
    if (status === current) {
      setOpen(false);
      return;
    }
    if (status === "IN_PROGRESS") {
      setMode("startDate");
      return;
    }
    if (status === "DONE") {
      setMode("endDate");
      return;
    }
    save(status);
  }

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (next) {
          resetToMenu();
          setOpen(true);
        } else if (!isPending) {
          setOpen(false);
        }
      }}
    >
      <PopoverPrimitive.Trigger
        render={
          <button
            type="button"
            disabled={isPending}
            aria-label={`Set status for ${taskName}`}
            className={cn(
              badgeVariants({ variant: "outline" }),
              "hover:ring-ring/30 cursor-pointer gap-1 font-medium transition-shadow hover:ring-2 focus-visible:ring-2 disabled:opacity-60",
              TASK_STATUS_TONE[current],
            )}
          />
        }
      >
        {current === "BLOCKED" ? <TriangleAlert className="size-3" /> : null}
        {taskStatusLabel(current)}
        <ChevronDown className="size-3 opacity-60" />
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner side="bottom" align="start" sideOffset={6} className="z-50">
          <PopoverPrimitive.Popup className="bg-popover text-popover-foreground ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 w-60 origin-(--transform-origin) rounded-lg p-2 shadow-md ring-1 duration-100 outline-none">
            {mode === "menu" ? (
              <div className="space-y-0.5">
                {TASK_STATUSES.map((status) => (
                  <button
                    key={status}
                    type="button"
                    disabled={isPending}
                    onClick={() => choose(status)}
                    className="hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm disabled:opacity-50"
                  >
                    <span
                      className={cn("size-2.5 rounded-full border", TASK_STATUS_TONE[status])}
                      aria-hidden
                    />
                    <span className="flex-1">{taskStatusLabel(status)}</span>
                    {status === current ? <Check className="size-3.5 opacity-70" /> : null}
                  </button>
                ))}
              </div>
            ) : mode === "block" ? (
              <div className="space-y-2 p-1">
                <p className="text-xs font-medium">Why is it blocked?</p>
                <Textarea
                  autoFocus
                  rows={2}
                  value={reason}
                  disabled={isPending}
                  placeholder="e.g. Waiting on rebar delivery"
                  onChange={(e) => setReason(e.target.value)}
                />
                <div className="flex justify-end gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() => setMode("menu")}
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={isPending || !reason.trim()}
                    onClick={() => save("BLOCKED", { blockReason: reason.trim() })}
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="animate-spin" /> Saving…
                      </>
                    ) : (
                      "Block task"
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 p-1">
                <p className="text-xs font-medium">
                  {mode === "startDate" ? "When did it start?" : "When was it completed?"}
                </p>
                <DatePicker
                  value={actualDate}
                  onChange={(v) => setActualDate(v || todayISO())}
                  disabled={isPending}
                  aria-label={mode === "startDate" ? "Actual start date" : "Actual completion date"}
                />
                <div className="flex justify-end gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() => setMode("menu")}
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={isPending}
                    onClick={() =>
                      mode === "startDate"
                        ? save("IN_PROGRESS", { actualStartDate: actualDate })
                        : save("DONE", { actualEndDate: actualDate })
                    }
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="animate-spin" /> Saving…
                      </>
                    ) : (
                      "Save"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

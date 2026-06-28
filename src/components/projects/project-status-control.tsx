"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { ChevronDown, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { PROJECT_STATUS_TONE } from "@/components/projects/project-status-badge";
import { badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { useProgressTransition } from "@/hooks/use-progress-transition";
import { allowedNextStatuses } from "@/modules/projects/domain";
import { changeProjectStatusAction } from "@/modules/projects/actions";
import { projectStatusLabel, type ProjectStatus } from "@/lib/statuses";
import { cn } from "@/lib/utils";

const todayISO = () => new Date().toISOString().slice(0, 10);

// The status pill IS the control: click it and pick an allowed next status from the
// open dropdown. Reversible moves (Active / On Hold / Planning→Active) save in one
// click; Completed first asks for the actual completion date (warning if tasks are
// still open — it warns, never blocks); Cancel is a destructive confirm step. The
// allowed transitions come from the domain state machine, and the server re-checks
// authorization — any {ok:false} surfaces as a toast.
export function ProjectStatusControl({
  projectId,
  status,
  openTaskCount = 0,
  blockedTaskCount = 0,
}: {
  projectId: string;
  status: ProjectStatus;
  /** Tasks not yet Done — surfaced as a soft warning when completing (warn, not block). */
  openTaskCount?: number;
  blockedTaskCount?: number;
}) {
  const router = useRouter();
  const [isPending, start] = useProgressTransition();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"menu" | "complete" | "cancel">("menu");
  const [endDate, setEndDate] = useState(todayISO());

  const next = allowedNextStatuses(status);

  function resetToMenu() {
    setMode("menu");
    setEndDate(todayISO());
  }

  function save(to: ProjectStatus, actualEndDate = "") {
    start(async () => {
      const result = await changeProjectStatusAction({ id: projectId, status: to, actualEndDate });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Project moved to ${projectStatusLabel(to)}.`);
      setOpen(false);
      router.refresh();
    });
  }

  function choose(to: ProjectStatus) {
    if (to === "COMPLETED") {
      setMode("complete");
      return;
    }
    if (to === "CANCELLED") {
      setMode("cancel");
      return;
    }
    save(to);
  }

  // Terminal lifecycle (Completed / Cancelled): nothing to change — read-only pill.
  if (next.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <span
          className={cn(
            badgeVariants({ variant: "outline" }),
            "font-medium",
            PROJECT_STATUS_TONE[status],
          )}
        >
          {projectStatusLabel(status)}
        </span>
        <span className="text-muted-foreground text-xs">
          {status === "COMPLETED" ? "Project closed out." : "No further transitions."}
        </span>
      </div>
    );
  }

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
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
            aria-label="Change project status"
            className={cn(
              badgeVariants({ variant: "outline" }),
              "hover:ring-ring/30 cursor-pointer gap-1 font-medium transition-shadow hover:ring-2 focus-visible:ring-2 disabled:opacity-60",
              PROJECT_STATUS_TONE[status],
            )}
          />
        }
      >
        {projectStatusLabel(status)}
        <ChevronDown className="size-3 opacity-60" />
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner side="bottom" align="start" sideOffset={6} className="z-50">
          <PopoverPrimitive.Popup className="bg-popover text-popover-foreground ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 w-64 origin-(--transform-origin) rounded-lg p-2 shadow-md ring-1 duration-100 outline-none">
            {mode === "menu" ? (
              <div className="space-y-0.5">
                {next.map((to) => (
                  <button
                    key={to}
                    type="button"
                    disabled={isPending}
                    onClick={() => choose(to)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm disabled:opacity-50",
                      to === "CANCELLED"
                        ? "text-destructive hover:bg-destructive/10"
                        : "hover:bg-accent",
                    )}
                  >
                    <span
                      className={cn("size-2.5 rounded-full border", PROJECT_STATUS_TONE[to])}
                      aria-hidden
                    />
                    <span className="flex-1">
                      {to === "CANCELLED" ? "Cancel project" : projectStatusLabel(to)}
                    </span>
                  </button>
                ))}
              </div>
            ) : mode === "complete" ? (
              <div className="space-y-3 p-1">
                <p className="text-sm font-medium">Complete this project?</p>
                {openTaskCount > 0 ? (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div className="space-y-0.5 text-xs">
                      <p className="font-medium text-amber-800 dark:text-amber-300">
                        {openTaskCount} task{openTaskCount === 1 ? "" : "s"} not yet done
                        {blockedTaskCount > 0 ? ` (${blockedTaskCount} blocked)` : ""}
                      </p>
                      <p className="text-muted-foreground">
                        Completing won&apos;t change them — you can still close out.
                      </p>
                    </div>
                  </div>
                ) : null}
                <div className="space-y-1.5">
                  <Label htmlFor="actualEndDate" className="text-xs">
                    Actual completion date
                  </Label>
                  <DatePicker
                    id="actualEndDate"
                    value={endDate}
                    onChange={(v) => setEndDate(v || todayISO())}
                    disabled={isPending}
                    aria-label="Actual completion date"
                  />
                </div>
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
                    onClick={() => save("COMPLETED", endDate)}
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="animate-spin" /> Saving…
                      </>
                    ) : (
                      "Complete project"
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 p-1">
                <p className="text-sm font-medium">Cancel this project?</p>
                <p className="text-muted-foreground text-xs">
                  This stops all activity on the project. It can&apos;t be reopened afterwards.
                </p>
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
                    variant="destructive"
                    size="sm"
                    disabled={isPending}
                    onClick={() => save("CANCELLED")}
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="animate-spin" /> Cancelling…
                      </>
                    ) : (
                      "Cancel project"
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

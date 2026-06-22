"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { Check, Loader2, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useProgressTransition } from "@/hooks/use-progress-transition";
import { cn } from "@/lib/utils";
import { updateTaskProgressAction } from "@/modules/projects/tasks/actions";

function clampPct(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

// The narrow assignee-or-manager quick-path: set just progress without opening the
// full task editor. The server re-checks authorization, so any {ok:false} surfaces
// as a toast and the input snaps back.
export function TaskProgressControl({
  taskId,
  taskName,
  progressPct,
}: {
  taskId: string;
  taskName: string;
  progressPct: number;
}) {
  const router = useRouter();
  const [isPending, start] = useProgressTransition();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(String(progressPct));

  function reopenWith() {
    setDraft(String(progressPct));
    setOpen(true);
  }

  function save() {
    const next = clampPct(Number(draft));
    if (next === progressPct) {
      setOpen(false);
      return;
    }
    start(async () => {
      const result = await updateTaskProgressAction({ id: taskId, progressPct: next });
      if (!result.ok) {
        toast.error(result.error);
        setDraft(String(progressPct));
        return;
      }
      toast.success(`${taskName}: progress set to ${next}%.`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (next) reopenWith();
        else if (!isPending) setOpen(false);
      }}
    >
      <PopoverPrimitive.Trigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label={`Update progress for ${taskName}`} />
        }
      >
        <SlidersHorizontal className="text-muted-foreground" />
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner side="bottom" align="end" sideOffset={6} className="z-50">
          <PopoverPrimitive.Popup className="bg-popover text-popover-foreground ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 w-60 origin-(--transform-origin) rounded-lg p-3 shadow-md ring-1 duration-100 outline-none">
            <Label htmlFor="quick-progress" className="text-xs">
              Progress — {taskName}
            </Label>
            <div className="mt-2 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  id="quick-progress"
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={draft}
                  disabled={isPending}
                  onChange={(e) => setDraft(e.target.value)}
                  className="accent-primary h-1.5 flex-1 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Progress percent"
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={draft}
                  disabled={isPending}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      save();
                    }
                  }}
                  className={cn(
                    "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-7 w-14 rounded-md border bg-transparent px-1.5 text-right text-sm tabular-nums outline-none focus-visible:ring-3 disabled:opacity-50",
                  )}
                  aria-label="Progress percent value"
                />
                <span className="text-muted-foreground text-xs">%</span>
              </div>
              <div className="flex justify-end gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpen(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button type="button" size="sm" onClick={save} disabled={isPending}>
                  {isPending ? (
                    <>
                      <Loader2 className="animate-spin" /> Saving…
                    </>
                  ) : (
                    <>
                      <Check /> Save
                    </>
                  )}
                </Button>
              </div>
            </div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { ProjectStatusBadge } from "@/components/projects/project-status-badge";
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
import { DatePicker } from "@/components/ui/date-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { useProgressTransition } from "@/hooks/use-progress-transition";
import { allowedNextStatuses } from "@/modules/projects/domain";
import { changeProjectStatusAction } from "@/modules/projects/actions";
import { projectStatusLabel, type ProjectStatus } from "@/lib/statuses";

const todayISO = () => new Date().toISOString().slice(0, 10);

export function ProjectStatusControl({
  projectId,
  status,
}: {
  projectId: string;
  status: ProjectStatus;
}) {
  const router = useRouter();
  const [isPending, start] = useProgressTransition();
  const [target, setTarget] = useState<ProjectStatus | null>(null);
  const [endDate, setEndDate] = useState(todayISO());

  const next = allowedNextStatuses(status);
  const completing = target === "COMPLETED";

  function open(to: ProjectStatus) {
    setEndDate(todayISO());
    setTarget(to);
  }

  function confirm() {
    if (!target) return;
    start(async () => {
      const result = await changeProjectStatusAction({
        id: projectId,
        status: target,
        actualEndDate: completing ? endDate : "",
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Project moved to ${projectStatusLabel(target)}.`);
      setTarget(null);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <ProjectStatusBadge status={status} />

      {next.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="sm" aria-label="Change project status" />}
          >
            Change status
            <ChevronDown className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {next.map((to) => (
              <DropdownMenuItem
                key={to}
                variant={to === "CANCELLED" ? "destructive" : "default"}
                onClick={() => open(to)}
              >
                {to === "CANCELLED" ? "Cancel project" : `Move to ${projectStatusLabel(to)}`}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <span className="text-muted-foreground text-xs">
          {status === "COMPLETED" ? "Project closed out." : "No further transitions."}
        </span>
      )}

      <AlertDialog
        open={target !== null}
        onOpenChange={(o) => {
          if (!o && !isPending) setTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {target === "CANCELLED"
                ? "Cancel this project?"
                : `Move to ${target ? projectStatusLabel(target) : ""}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {target === "CANCELLED" ? (
                <>This stops all activity on the project. It can&apos;t be reopened afterwards.</>
              ) : completing ? (
                <>Mark the work signed off and stamp its actual completion date.</>
              ) : (
                <>
                  Status will change from{" "}
                  <span className="font-medium">{projectStatusLabel(status)}</span> to{" "}
                  <span className="font-medium">{target ? projectStatusLabel(target) : ""}</span>.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {completing ? (
            <div className="space-y-2 text-left">
              <Label htmlFor="actualEndDate">Actual completion date</Label>
              <DatePicker
                id="actualEndDate"
                value={endDate}
                onChange={(v) => setEndDate(v || todayISO())}
                disabled={isPending}
                aria-label="Actual completion date"
              />
            </div>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Keep current</AlertDialogCancel>
            <AlertDialogAction
              variant={target === "CANCELLED" ? "destructive" : "default"}
              onClick={confirm}
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Updating…
                </>
              ) : target === "CANCELLED" ? (
                "Cancel project"
              ) : (
                "Confirm"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

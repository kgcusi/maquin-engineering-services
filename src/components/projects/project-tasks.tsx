"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import {
  CalendarRange,
  ListTree,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { PhaseFormDialog } from "@/components/projects/phase-form-dialog";
import { TaskFormDialog } from "@/components/projects/task-form-dialog";
import { TaskProgressControl } from "@/components/projects/task-progress-control";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProgressTransition } from "@/hooks/use-progress-transition";
import { formatDateTime } from "@/lib/datetime";
import { deriveProgressStatus, progressStatusLabel, type ProgressStatus } from "@/lib/statuses";
import { cn } from "@/lib/utils";
import { isTaskDelayed } from "@/modules/projects/tasks/domain";
import { deletePhaseAction, deleteTaskAction } from "@/modules/projects/tasks/actions";
import type { PhaseWithTasks, TaskRow } from "@/modules/projects/tasks/queries";

type Option = { id: string; name: string };

const todayISO = () => new Date().toISOString().slice(0, 10);

function fmtDate(iso: string | null, timeZone: string): string | null {
  if (!iso) return null;
  return formatDateTime(`${iso}T00:00:00`, timeZone, "date");
}

// ── Progress meter (matches the projects table for cross-screen consistency) ──
function ProgressMeter({ pct, className }: { pct: number; className?: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const done = clamped >= 100;
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
        <div
          className={cn(
            "h-full rounded-full transition-[width]",
            done ? "bg-emerald-500" : "bg-primary",
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="text-muted-foreground w-9 shrink-0 text-right text-xs tabular-nums">
        {clamped}%
      </span>
    </div>
  );
}

const STATUS_TONE: Record<ProgressStatus, string> = {
  NOT_STARTED: "border-border text-muted-foreground",
  IN_PROGRESS: "border-primary/30 bg-primary/10 text-primary",
  DONE: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 dark:border-emerald-400/30",
};

function StatusBadge({ pct }: { pct: number }) {
  const status = deriveProgressStatus(pct);
  return (
    <Badge variant="outline" className={cn("font-medium", STATUS_TONE[status])}>
      {progressStatusLabel(status)}
    </Badge>
  );
}

function BlockedBadge({ reason }: { reason: string | null }) {
  const label = (
    <Badge
      variant="outline"
      className="cursor-default gap-1 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:border-amber-400/30 dark:text-amber-400"
    >
      <TriangleAlert className="size-3" /> Blocked
    </Badge>
  );
  if (!reason?.trim()) return label;
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger render={label} />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner side="top" sideOffset={6} className="z-50">
          <TooltipPrimitive.Popup className="bg-popover text-popover-foreground ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 max-w-xs rounded-md px-2.5 py-1.5 text-xs shadow-md ring-1 duration-100">
            {reason}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

function DelayedBadge() {
  return (
    <Badge variant="destructive" className="gap-1">
      <CalendarRange className="size-3" /> Delayed
    </Badge>
  );
}

// ── Delete confirm (phase OR task), destructive + double-submit safe ──────────
type DeleteTarget =
  | { kind: "phase"; id: string; name: string; taskCount: number }
  | { kind: "task"; id: string; name: string }
  | null;

function TaskDeleteDialog({ target, onClose }: { target: DeleteTarget; onClose: () => void }) {
  const router = useRouter();
  const [isPending, start] = useProgressTransition();

  function confirm() {
    if (!target) return;
    start(async () => {
      const result =
        target.kind === "phase"
          ? await deletePhaseAction({ id: target.id })
          : await deleteTaskAction({ id: target.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(target.kind === "phase" ? "Phase deleted." : "Task deleted.");
      router.refresh();
      onClose();
    });
  }

  const isPhase = target?.kind === "phase";

  return (
    <AlertDialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open && !isPending) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{isPhase ? "Delete phase?" : "Delete task?"}</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-medium">{target?.name}</span>{" "}
            {isPhase ? (
              <>
                will be removed.
                {target && target.kind === "phase" && target.taskCount > 0 ? (
                  <>
                    {" "}
                    Its {target.taskCount} {target.taskCount === 1 ? "task" : "tasks"} go with it,
                    and project progress recalculates.
                  </>
                ) : (
                  <> Project progress recalculates.</>
                )}
              </>
            ) : (
              <> will be removed and its phase progress recalculates.</>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={confirm} disabled={isPending}>
            {isPending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ── Task row ──────────────────────────────────────────────────────────────────
function TaskRowItem({
  task,
  canManage,
  viewerId,
  timeZone,
  onEdit,
  onDelete,
}: {
  task: TaskRow;
  canManage: boolean;
  viewerId: string;
  timeZone: string;
  onEdit: (task: TaskRow) => void;
  onDelete: (task: TaskRow) => void;
}) {
  const delayed = isTaskDelayed(task.progressPct, task.dueDate, task.isDelayed, todayISO());
  const canSetProgress = canManage || viewerId === task.assigneeId;
  const due = fmtDate(task.dueDate, timeZone);

  return (
    <li className="grid grid-cols-1 items-center gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto] sm:gap-y-1">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium">{task.name}</span>
          <StatusBadge pct={task.progressPct} />
          {task.isBlocked ? <BlockedBadge reason={task.blockedReason} /> : null}
          {delayed ? <DelayedBadge /> : null}
        </div>
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <UserRound className="size-3.5 shrink-0" />
          {task.assigneeName ? (
            <span>{task.assigneeName}</span>
          ) : (
            <span className="italic">Unassigned</span>
          )}
          {due ? (
            <>
              <span aria-hidden>·</span>
              <span className={cn("tabular-nums", delayed && "text-destructive font-medium")}>
                Due {due}
              </span>
            </>
          ) : null}
        </p>
      </div>

      <ProgressMeter pct={task.progressPct} className="max-w-56" />

      <div className="flex items-center justify-end gap-0.5">
        {canSetProgress ? (
          <TaskProgressControl
            taskId={task.id}
            taskName={task.name}
            progressPct={task.progressPct}
          />
        ) : null}
        {canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label={`Manage task ${task.name}`} />
              }
            >
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(task)}>
                <Pencil />
                Edit task
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => onDelete(task)}>
                <Trash2 />
                Delete task
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </li>
  );
}

// ── Phase section ─────────────────────────────────────────────────────────────
function PhaseSection({
  phase,
  index,
  canManage,
  viewerId,
  timeZone,
  onAddTask,
  onEditPhase,
  onDeletePhase,
  onEditTask,
  onDeleteTask,
}: {
  phase: PhaseWithTasks;
  index: number;
  canManage: boolean;
  viewerId: string;
  timeZone: string;
  onAddTask: (phase: PhaseWithTasks) => void;
  onEditPhase: (phase: PhaseWithTasks) => void;
  onDeletePhase: (phase: PhaseWithTasks) => void;
  onEditTask: (phase: PhaseWithTasks, task: TaskRow) => void;
  onDeleteTask: (task: TaskRow) => void;
}) {
  const start = fmtDate(phase.startDate, timeZone);
  const end = fmtDate(phase.targetEndDate, timeZone);
  const schedule = start && end ? `${start} → ${end}` : (end ?? start ?? null);

  return (
    <section className="overflow-hidden rounded-lg border">
      <header className="bg-muted/30 flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b px-4 py-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2.5">
            <span className="text-muted-foreground bg-background flex size-6 shrink-0 items-center justify-center rounded-md border text-xs font-semibold tabular-nums">
              {index + 1}
            </span>
            <h3 className="truncate text-sm font-semibold tracking-tight">{phase.name}</h3>
            <span className="text-muted-foreground text-xs tabular-nums">
              {phase.tasks.length} {phase.tasks.length === 1 ? "task" : "tasks"}
            </span>
          </div>
          {schedule ? (
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <CalendarRange className="size-3.5 shrink-0" />
              <span className="tabular-nums">{schedule}</span>
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <ProgressMeter pct={phase.progressPct} className="w-40" />
          {canManage ? (
            <div className="flex items-center gap-0.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAddTask(phase)}
                aria-label={`Add task to ${phase.name}`}
              >
                <Plus />
                Add task
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Manage phase ${phase.name}`}
                    />
                  }
                >
                  <MoreHorizontal />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEditPhase(phase)}>
                    <Pencil />
                    Edit phase
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={() => onDeletePhase(phase)}>
                    <Trash2 />
                    Delete phase
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}
        </div>
      </header>

      {phase.tasks.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
          <p className="text-muted-foreground text-sm">No tasks in this phase yet.</p>
          {canManage ? (
            <Button variant="outline" size="sm" onClick={() => onAddTask(phase)}>
              <Plus />
              Add the first task
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="divide-border divide-y">
          {phase.tasks.map((task) => (
            <TaskRowItem
              key={task.id}
              task={task}
              canManage={canManage}
              viewerId={viewerId}
              timeZone={timeZone}
              onEdit={(t) => onEditTask(phase, t)}
              onDelete={onDeleteTask}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Tab body ──────────────────────────────────────────────────────────────────
type PhaseEditState = { mode: "create" } | { mode: "edit"; phase: PhaseWithTasks } | null;
type TaskEditState = { phaseId: string; phaseName: string; task: TaskRow | null } | null;

export function ProjectTasks({
  projectId,
  phases,
  assignees,
  canManage,
  viewerId,
  timeZone,
}: {
  projectId: string;
  phases: PhaseWithTasks[];
  assignees: Option[];
  canManage: boolean;
  viewerId: string;
  timeZone: string;
}) {
  const [phaseEdit, setPhaseEdit] = useState<PhaseEditState>(null);
  const [taskEdit, setTaskEdit] = useState<TaskEditState>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const nextSequence = phases.reduce((max, p) => Math.max(max, p.sequence + 1), 0);

  if (phases.length === 0) {
    return (
      <>
        <div className="flex max-w-2xl flex-col items-center gap-3 rounded-lg border border-dashed py-14 text-center">
          <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full">
            <ListTree className="size-5" />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-medium">No phases yet</p>
            <p className="text-muted-foreground mx-auto max-w-sm text-sm">
              {canManage
                ? "Break the work down into phases, then add tasks under each. Progress rolls up automatically."
                : "When the project lead lays out the work breakdown, phases and tasks will appear here."}
            </p>
          </div>
          {canManage ? (
            <Button className="mt-1" onClick={() => setPhaseEdit({ mode: "create" })}>
              <Plus />
              Add the first phase
            </Button>
          ) : null}
        </div>

        {canManage ? (
          <PhaseFormDialog
            open={phaseEdit?.mode === "create"}
            onOpenChange={(open) => {
              if (!open) setPhaseEdit(null);
            }}
            projectId={projectId}
            nextSequence={nextSequence}
          />
        ) : null}
      </>
    );
  }

  return (
    <div className="space-y-4">
      {canManage ? (
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => setPhaseEdit({ mode: "create" })}>
            <Plus />
            Add phase
          </Button>
        </div>
      ) : null}

      <div className="space-y-3">
        {phases.map((phase, index) => (
          <PhaseSection
            key={phase.id}
            phase={phase}
            index={index}
            canManage={canManage}
            viewerId={viewerId}
            timeZone={timeZone}
            onAddTask={(p) => setTaskEdit({ phaseId: p.id, phaseName: p.name, task: null })}
            onEditPhase={(p) => setPhaseEdit({ mode: "edit", phase: p })}
            onDeletePhase={(p) =>
              setDeleteTarget({
                kind: "phase",
                id: p.id,
                name: p.name,
                taskCount: p.tasks.length,
              })
            }
            onEditTask={(p, t) => setTaskEdit({ phaseId: p.id, phaseName: p.name, task: t })}
            onDeleteTask={(t) => setDeleteTarget({ kind: "task", id: t.id, name: t.name })}
          />
        ))}
      </div>

      {canManage ? (
        <PhaseFormDialog
          open={phaseEdit !== null}
          onOpenChange={(open) => {
            if (!open) setPhaseEdit(null);
          }}
          projectId={projectId}
          phase={phaseEdit?.mode === "edit" ? phaseEdit.phase : null}
          nextSequence={nextSequence}
        />
      ) : null}

      {canManage && taskEdit ? (
        <TaskFormDialog
          open
          onOpenChange={(open) => {
            if (!open) setTaskEdit(null);
          }}
          phaseId={taskEdit.phaseId}
          phaseName={taskEdit.phaseName}
          task={taskEdit.task}
          assignees={assignees}
        />
      ) : null}

      <TaskDeleteDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} />
    </div>
  );
}

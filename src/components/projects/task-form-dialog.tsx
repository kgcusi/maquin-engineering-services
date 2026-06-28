"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TASK_STATUS_TONE } from "@/components/projects/task-status";
import { useProgressTransition } from "@/hooks/use-progress-transition";
import {
  TASK_STATUS_OPTIONS,
  deriveTaskStatus,
  progressForStatus,
  type TaskStatus,
} from "@/lib/statuses";
import { cn } from "@/lib/utils";
import { createTaskAction, updateTaskAction } from "@/modules/projects/tasks/actions";
import { round2 } from "@/modules/projects/tasks/domain";
import type { TaskRow } from "@/modules/projects/tasks/queries";
import {
  createTaskSchema,
  type CreateTaskFormValues,
  type CreateTaskInput,
} from "@/modules/projects/tasks/schema";

type Option = { id: string; name: string };

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-destructive text-xs">
      {message}
    </p>
  );
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phaseId: string;
  phaseName: string;
  task?: TaskRow | null;
  assignees: Option[];
  /** Weight already allocated to the phase's OTHER tasks (this task excluded). */
  phaseAllocatedPct?: number;
};

export function TaskFormDialog({
  open,
  onOpenChange,
  phaseId,
  phaseName,
  task,
  assignees,
  phaseAllocatedPct = 0,
}: Props) {
  const editing = Boolean(task);
  return (
    <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit task" : "New task"}</DialogTitle>
          <DialogDescription>
            {editing ? (
              <>Update this task under {phaseName}.</>
            ) : (
              <>Add a task under {phaseName} and assign it to a team member.</>
            )}
          </DialogDescription>
        </DialogHeader>
        <TaskForm
          key={task?.id ?? "new"}
          phaseId={phaseId}
          task={task ?? null}
          assignees={assignees}
          phaseAllocatedPct={phaseAllocatedPct}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function TaskForm({
  phaseId,
  task,
  assignees,
  phaseAllocatedPct,
  onDone,
}: {
  phaseId: string;
  task: TaskRow | null;
  assignees: Option[];
  phaseAllocatedPct: number;
  onDone: () => void;
}) {
  const router = useRouter();
  const [isPending, start] = useProgressTransition();

  const assigneeItems = assignees.map((a) => ({ value: a.id, label: a.name }));

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<CreateTaskFormValues, unknown, CreateTaskInput>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      phaseId,
      name: task?.name ?? "",
      assigneeId: task?.assigneeId ?? "",
      targetStartDate: task?.targetStartDate ?? "",
      targetEndDate: task?.targetEndDate ?? "",
      actualStartDate: task?.actualStartDate ?? "",
      actualEndDate: task?.actualEndDate ?? "",
      progressPct: task?.progressPct ?? 0,
      weightPct: task?.weightPct,
      isBlocked: task?.isBlocked ?? false,
      blockedReason: task?.blockedReason ?? "",
      remarks: task?.remarks ?? "",
    },
  });

  const isBlocked = useWatch({ control, name: "isBlocked" });
  const progressValue = useWatch({ control, name: "progressPct" });
  const weightValue = useWatch({ control, name: "weightPct" });
  // Drives the soft "end ≥ start" calendar bound (the Zod superRefine is the real guard).
  const targetStart = useWatch({ control, name: "targetStartDate" });
  const actualStart = useWatch({ control, name: "actualStartDate" });

  // Status is the single control; it drives the two stored fields. Blocked overrides
  // the progress-derived label and keeps progress as-is; the others set 0/50/100 and
  // clear the block. A reason field appears only while Blocked.
  const status = deriveTaskStatus(Number(progressValue) || 0, Boolean(isBlocked));

  function onStatusChange(next: TaskStatus) {
    if (next === "BLOCKED") {
      setValue("isBlocked", true, { shouldDirty: true });
      return;
    }
    setValue("isBlocked", false, { shouldDirty: true });
    setValue("progressPct", progressForStatus(next), { shouldDirty: true });
  }

  // Phase allocation maths: how much of the phase's 100% is spent once this task's
  // weight is counted, and how much is left. The server is the authority; this just
  // gives live feedback and blocks an obviously over-allocated submit.
  const remaining = round2(Math.max(0, 100 - phaseAllocatedPct));
  const entered = Number(weightValue) || 0;
  const phaseTotal = round2(phaseAllocatedPct + entered);
  const overAllocated = phaseTotal > 100.001;
  const allocationHint = overAllocated
    ? `Only ${remaining}% of this phase is unallocated — lower this task's weight.`
    : !task && entered === 0
      ? `${remaining}% of this phase is unallocated. Leave blank to take it all.`
      : `Phase: ${phaseTotal}% allocated · ${round2(Math.max(0, 100 - phaseTotal))}% unallocated`;

  function onSubmit(values: CreateTaskInput) {
    start(async () => {
      const result = task
        ? await updateTaskAction({ ...values, id: task.id })
        : await createTaskAction(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(task ? "Task updated." : "Task added.");
      router.refresh();
      onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="task-name" required>
          Task name
        </Label>
        <Input
          id="task-name"
          autoComplete="off"
          disabled={isPending}
          placeholder="e.g. Pour column footings"
          {...register("name")}
        />
        <FieldError message={errors.name?.message} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="task-assigneeId">Assignee</Label>
          <Controller
            control={control}
            name="assigneeId"
            render={({ field }) => (
              <Combobox
                items={assigneeItems}
                value={field.value || null}
                onValueChange={(v) => field.onChange(v ?? "")}
                placeholder="Unassigned"
                searchPlaceholder="Search team…"
                emptyText="No team members on this project."
                disabled={isPending}
                aria-label="Assignee"
              />
            )}
          />
          <FieldError message={errors.assigneeId?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="task-status">Status</Label>
          <Select
            items={TASK_STATUS_OPTIONS}
            value={status}
            onValueChange={(value) => onStatusChange(value as TaskStatus)}
            disabled={isPending}
          >
            <SelectTrigger id="task-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  <span
                    className={cn(
                      "size-2.5 rounded-full border",
                      TASK_STATUS_TONE[o.value as TaskStatus],
                    )}
                    aria-hidden
                  />
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError message={errors.progressPct?.message} />
        </div>
      </div>

      {status === "BLOCKED" ? (
        <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3.5 py-3">
          <Label htmlFor="task-blockedReason" required>
            Why is it blocked?
          </Label>
          <Textarea
            id="task-blockedReason"
            rows={2}
            placeholder="What is blocking this task? The project lead is notified."
            disabled={isPending}
            {...register("blockedReason")}
          />
          <FieldError message={errors.blockedReason?.message} />
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="task-weightPct">Weight — share of phase (%)</Label>
        <Input
          id="task-weightPct"
          type="number"
          min={0}
          max={100}
          inputMode="decimal"
          disabled={isPending}
          placeholder={task ? undefined : String(remaining)}
          aria-invalid={overAllocated}
          {...register("weightPct")}
        />
        <p className={cn("text-xs", overAllocated ? "text-destructive" : "text-muted-foreground")}>
          {allocationHint}
        </p>
        <FieldError message={errors.weightPct?.message} />
      </div>

      <div className="space-y-3">
        <p className="text-muted-foreground text-xs font-medium">Schedule — target vs actual</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="task-targetStartDate">Target start</Label>
            <Controller
              control={control}
              name="targetStartDate"
              render={({ field }) => (
                <DatePicker
                  id="task-targetStartDate"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  disabled={isPending}
                  aria-label="Target start date"
                />
              )}
            />
            <FieldError message={errors.targetStartDate?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-targetEndDate">Target end</Label>
            <Controller
              control={control}
              name="targetEndDate"
              render={({ field }) => (
                <DatePicker
                  id="task-targetEndDate"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  min={targetStart || undefined}
                  disabled={isPending}
                  aria-label="Target end date"
                />
              )}
            />
            <FieldError message={errors.targetEndDate?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-actualStartDate">Actual start</Label>
            <Controller
              control={control}
              name="actualStartDate"
              render={({ field }) => (
                <DatePicker
                  id="task-actualStartDate"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  disabled={isPending}
                  aria-label="Actual start date"
                />
              )}
            />
            <FieldError message={errors.actualStartDate?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-actualEndDate">Actual end</Label>
            <Controller
              control={control}
              name="actualEndDate"
              render={({ field }) => (
                <DatePicker
                  id="task-actualEndDate"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  min={actualStart || undefined}
                  disabled={isPending}
                  aria-label="Actual end date"
                />
              )}
            />
            <FieldError message={errors.actualEndDate?.message} />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="task-remarks">Remarks</Label>
        <Textarea
          id="task-remarks"
          rows={2}
          placeholder="Notes about this task…"
          disabled={isPending}
          {...register("remarks")}
        />
        <FieldError message={errors.remarks?.message} />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || overAllocated}>
          {isPending ? (
            <>
              <Loader2 className="animate-spin" /> {task ? "Saving…" : "Adding…"}
            </>
          ) : task ? (
            "Save changes"
          ) : (
            "Add task"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

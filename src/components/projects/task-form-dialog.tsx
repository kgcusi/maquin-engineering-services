"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { useProgressTransition } from "@/hooks/use-progress-transition";
import { cn } from "@/lib/utils";
import { createTaskAction, updateTaskAction } from "@/modules/projects/tasks/actions";
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
};

export function TaskFormDialog({ open, onOpenChange, phaseId, phaseName, task, assignees }: Props) {
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
  onDone,
}: {
  phaseId: string;
  task: TaskRow | null;
  assignees: Option[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [isPending, start] = useProgressTransition();

  const assigneeItems = assignees.map((a) => ({ value: a.id, label: a.name }));

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CreateTaskFormValues, unknown, CreateTaskInput>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      phaseId,
      name: task?.name ?? "",
      assigneeId: task?.assigneeId ?? "",
      startDate: task?.startDate ?? "",
      dueDate: task?.dueDate ?? "",
      progressPct: task?.progressPct ?? 0,
      isBlocked: task?.isBlocked ?? false,
      blockedReason: task?.blockedReason ?? "",
      remarks: task?.remarks ?? "",
    },
  });

  const isBlocked = useWatch({ control, name: "isBlocked" });

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
          <Label htmlFor="task-progressPct">Progress (%)</Label>
          <Input
            id="task-progressPct"
            type="number"
            min={0}
            max={100}
            inputMode="numeric"
            disabled={isPending}
            {...register("progressPct")}
          />
          <FieldError message={errors.progressPct?.message} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="task-startDate">Start date</Label>
          <Controller
            control={control}
            name="startDate"
            render={({ field }) => (
              <DatePicker
                id="task-startDate"
                value={field.value ?? ""}
                onChange={field.onChange}
                disabled={isPending}
                aria-label="Task start date"
              />
            )}
          />
          <FieldError message={errors.startDate?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="task-dueDate">Due date</Label>
          <Controller
            control={control}
            name="dueDate"
            render={({ field }) => (
              <DatePicker
                id="task-dueDate"
                value={field.value ?? ""}
                onChange={field.onChange}
                disabled={isPending}
                aria-label="Task due date"
              />
            )}
          />
          <FieldError message={errors.dueDate?.message} />
        </div>
      </div>

      <div className="space-y-3 rounded-lg border px-3.5 py-3">
        <Controller
          control={control}
          name="isBlocked"
          render={({ field }) => (
            <Label htmlFor="task-isBlocked" className="items-start gap-2.5">
              <Checkbox
                id="task-isBlocked"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked)}
                disabled={isPending}
                className="mt-0.5"
              />
              <span className="space-y-0.5">
                <span className="block text-sm font-medium">Blocked</span>
                <span className="text-muted-foreground block text-xs font-normal">
                  Flag this task as stalled. A reason is required so the team knows what to clear.
                </span>
              </span>
            </Label>
          )}
        />
        <div className={cn("space-y-2", !isBlocked && "hidden")}>
          <Label htmlFor="task-blockedReason" required={Boolean(isBlocked)}>
            Reason
          </Label>
          <Textarea
            id="task-blockedReason"
            rows={2}
            placeholder="What is blocking this task?"
            disabled={isPending}
            {...register("blockedReason")}
          />
          <FieldError message={errors.blockedReason?.message} />
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
        <Button type="submit" disabled={isPending}>
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

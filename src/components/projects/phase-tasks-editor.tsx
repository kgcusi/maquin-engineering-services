"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm, useWatch, type Control } from "react-hook-form";
import { Check, Loader2, Plus, Scale, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PROGRESS_STATUS_TONE } from "@/components/projects/task-status";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProgressTransition } from "@/hooks/use-progress-transition";
import {
  PROGRESS_STATUSES,
  PROGRESS_STATUS_OPTIONS,
  deriveProgressStatus,
  progressForStatus,
  progressStatusLabel,
  type ProgressStatus,
} from "@/lib/statuses";
import { cn } from "@/lib/utils";
import { round2 } from "@/modules/projects/tasks/domain";
import { bulkUpdateTasksAction } from "@/modules/projects/tasks/actions";
import type { TaskRow } from "@/modules/projects/tasks/queries";

type Option = { id: string; name: string };

type RowValues = {
  id?: string;
  name: string;
  assigneeId: string;
  targetStartDate: string;
  targetEndDate: string;
  weightPct: string;
  progressPct: string;
};
type FormValues = { rows: RowValues[] };

const ALLOC_EPSILON = 0.001;

function clampStr(raw: string): string {
  const t = raw.trim();
  if (t === "") return "";
  const n = Number(t);
  if (!Number.isFinite(n)) return "";
  return String(round2(Math.max(0, Math.min(100, n))));
}

function toRow(task: TaskRow): RowValues {
  return {
    id: task.id,
    name: task.name,
    assigneeId: task.assigneeId ?? "",
    targetStartDate: task.targetStartDate ?? "",
    targetEndDate: task.targetEndDate ?? "",
    weightPct: String(task.weightPct),
    progressPct: String(task.progressPct),
  };
}

export function PhaseTasksEditor({
  open,
  onOpenChange,
  phaseId,
  phaseName,
  tasks,
  assignees,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phaseId: string;
  phaseName: string;
  tasks: TaskRow[];
  assignees: Option[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit tasks — {phaseName}</DialogTitle>
          <DialogDescription>
            Allocate each task a share of the phase. Weights are the slice of this phase a task
            carries; they can&apos;t total more than 100%.
          </DialogDescription>
        </DialogHeader>
        <EditorBody
          key={phaseId}
          phaseId={phaseId}
          tasks={tasks}
          assignees={assignees}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function EditorBody({
  phaseId,
  tasks,
  assignees,
  onDone,
}: {
  phaseId: string;
  tasks: TaskRow[];
  assignees: Option[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [isPending, start] = useProgressTransition();
  const assigneeItems = useMemo(
    () => assignees.map((a) => ({ value: a.id, label: a.name })),
    [assignees],
  );

  const { control, register, handleSubmit, setValue, getValues } = useForm<FormValues>({
    defaultValues: { rows: tasks.length ? tasks.map(toRow) : [blankRow()] },
  });
  const rows = useFieldArray({ control, name: "rows" });

  const watched = useWatch({ control, name: "rows" });
  const allocated = round2(
    (watched ?? []).reduce((sum, r) => sum + (Number(r?.weightPct) || 0), 0),
  );
  const unallocated = round2(Math.max(0, 100 - allocated));
  const over = allocated > 100 + ALLOC_EPSILON;

  function distribute() {
    const current = getValues().rows;
    const n = current.length;
    if (n === 0) return;
    const even = round2(100 / n);
    current.forEach((_, i) => {
      const value = i === n - 1 ? round2(100 - even * (n - 1)) : even;
      setValue(`rows.${i}.weightPct`, String(value), { shouldDirty: true });
    });
  }

  function onSubmit(values: FormValues) {
    if (values.rows.some((r) => !r.name.trim())) {
      toast.error("Every task needs a name.");
      return;
    }
    start(async () => {
      const result = await bulkUpdateTasksAction({
        phaseId,
        rows: values.rows.map((r) => ({
          id: r.id || undefined,
          name: r.name.trim(),
          assigneeId: r.assigneeId,
          targetStartDate: r.targetStartDate || undefined,
          targetEndDate: r.targetEndDate || undefined,
          weightPct: Number(r.weightPct) || 0,
          progressPct: Number(r.progressPct) || 0,
        })),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Tasks updated.");
      router.refresh();
      onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <div className="text-muted-foreground hidden px-1 text-xs font-medium sm:grid sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_4.5rem_8.5rem_2rem] sm:gap-2">
          <span>Task</span>
          <span>Assignee</span>
          <span className="text-right">Weight %</span>
          <span>Status</span>
          <span />
        </div>

        <ul className="space-y-2 sm:space-y-3">
          {rows.fields.map((field, i) => (
            <li
              key={field.id}
              className="space-y-2 rounded-lg border p-3 sm:space-y-1.5 sm:rounded-none sm:border-0 sm:p-0"
            >
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_4.5rem_8.5rem_2rem] sm:items-center">
                <Input
                  placeholder="Task name"
                  aria-label="Task name"
                  disabled={isPending}
                  {...register(`rows.${i}.name` as const)}
                />
                <AssigneeCell control={control} index={i} items={assigneeItems} />
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100}
                  aria-label="Weight percent"
                  disabled={isPending}
                  className="text-right tabular-nums"
                  {...register(`rows.${i}.weightPct` as const, {
                    onBlur: (e) =>
                      setValue(`rows.${i}.weightPct`, clampStr(e.target.value), {
                        shouldDirty: true,
                      }),
                  })}
                />
                <StatusCell control={control} index={i} disabled={isPending} />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove task"
                  disabled={isPending}
                  onClick={() => rows.remove(i)}
                  className="text-muted-foreground hover:text-destructive justify-self-end"
                >
                  <Trash2 />
                </Button>
              </div>
              <ScheduleCell control={control} index={i} disabled={isPending} />
            </li>
          ))}
        </ul>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => rows.append(blankRow())}
        >
          <Plus /> Add task
        </Button>
      </div>

      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-sm",
          over
            ? "border-destructive/40 bg-destructive/5 text-destructive"
            : "bg-muted/30 text-muted-foreground",
        )}
      >
        <div className="flex items-center gap-1.5">
          <Scale className="size-4 shrink-0" />
          {over ? (
            <span className="font-medium">
              Over-allocated by {round2(allocated - 100)}% — trim to 100% to save.
            </span>
          ) : (
            <span>
              <span className="text-foreground font-medium tabular-nums">{allocated}%</span>{" "}
              allocated · <span className="tabular-nums">{unallocated}%</span> unallocated
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPending || rows.fields.length === 0}
          onClick={distribute}
        >
          Distribute evenly
        </Button>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || over}>
          {isPending ? (
            <>
              <Loader2 className="animate-spin" /> Saving…
            </>
          ) : (
            <>
              <Check /> Save tasks
            </>
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

function AssigneeCell({
  control,
  index,
  items,
}: {
  control: Control<FormValues>;
  index: number;
  items: { value: string; label: string }[];
}) {
  return (
    <Controller
      control={control}
      name={`rows.${index}.assigneeId` as const}
      render={({ field }) => (
        <Combobox
          items={items}
          value={field.value || null}
          onValueChange={(v) => field.onChange(v ?? "")}
          placeholder="Unassigned"
          searchPlaceholder="Search team…"
          emptyText="No team members."
          aria-label="Assignee"
        />
      )}
    />
  );
}

function StatusCell({
  control,
  index,
  disabled,
}: {
  control: Control<FormValues>;
  index: number;
  disabled: boolean;
}) {
  return (
    <Controller
      control={control}
      name={`rows.${index}.progressPct` as const}
      render={({ field }) => {
        const status = deriveProgressStatus(Number(field.value) || 0);
        return (
          <Select
            items={PROGRESS_STATUS_OPTIONS}
            value={status}
            onValueChange={(value) =>
              field.onChange(String(progressForStatus(value as ProgressStatus)))
            }
            disabled={disabled}
          >
            <SelectTrigger size="sm" className="w-full" aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROGRESS_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  <span
                    className={cn("size-2.5 rounded-full border", PROGRESS_STATUS_TONE[s])}
                    aria-hidden
                  />
                  {progressStatusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }}
    />
  );
}

function ScheduleCell({
  control,
  index,
  disabled,
}: {
  control: Control<FormValues>;
  index: number;
  disabled: boolean;
}) {
  const start = useWatch({ control, name: `rows.${index}.targetStartDate` as const });
  return (
    <div className="flex flex-wrap items-center gap-2 sm:pl-1">
      <span className="text-muted-foreground text-xs font-medium">Target</span>
      <Controller
        control={control}
        name={`rows.${index}.targetStartDate` as const}
        render={({ field }) => (
          <DatePicker
            value={field.value ?? ""}
            onChange={field.onChange}
            disabled={disabled}
            placeholder="Start"
            aria-label="Target start date"
            className="w-[8.5rem]"
          />
        )}
      />
      <span className="text-muted-foreground text-xs" aria-hidden>
        →
      </span>
      <Controller
        control={control}
        name={`rows.${index}.targetEndDate` as const}
        render={({ field }) => (
          <DatePicker
            value={field.value ?? ""}
            onChange={field.onChange}
            min={start || undefined}
            disabled={disabled}
            placeholder="End"
            aria-label="Target end date"
            className="w-[8.5rem]"
          />
        )}
      />
    </div>
  );
}

function blankRow(): RowValues {
  return {
    name: "",
    assigneeId: "",
    targetStartDate: "",
    targetEndDate: "",
    weightPct: "",
    progressPct: "0",
  };
}

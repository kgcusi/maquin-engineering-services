"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { createPhaseAction, updatePhaseAction } from "@/modules/projects/tasks/actions";
import type { PhaseWithTasks } from "@/modules/projects/tasks/queries";
import {
  createPhaseSchema,
  type CreatePhaseFormValues,
  type CreatePhaseInput,
} from "@/modules/projects/tasks/schema";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-destructive text-xs">
      {message}
    </p>
  );
}

type PhaseSummary = Pick<
  PhaseWithTasks,
  | "id"
  | "name"
  | "sequence"
  | "targetStartDate"
  | "targetEndDate"
  | "actualStartDate"
  | "actualEndDate"
  | "remarks"
>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  phase?: PhaseSummary | null;
  /** Pre-fill sequence for a brand-new phase (next slot after the last one). */
  nextSequence: number;
};

export function PhaseFormDialog({ open, onOpenChange, projectId, phase, nextSequence }: Props) {
  const editing = Boolean(phase);
  return (
    <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit phase" : "New phase"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Rename this phase or adjust its schedule. Progress rolls up from its tasks."
              : "Group related tasks under a phase. Sequence orders it within the project."}
          </DialogDescription>
        </DialogHeader>
        <PhaseForm
          key={phase?.id ?? "new"}
          projectId={projectId}
          phase={phase ?? null}
          nextSequence={nextSequence}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function PhaseForm({
  projectId,
  phase,
  nextSequence,
  onDone,
}: {
  projectId: string;
  phase: PhaseSummary | null;
  nextSequence: number;
  onDone: () => void;
}) {
  const router = useRouter();
  const [isPending, start] = useProgressTransition();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CreatePhaseFormValues, unknown, CreatePhaseInput>({
    resolver: zodResolver(createPhaseSchema),
    defaultValues: {
      projectId,
      name: phase?.name ?? "",
      sequence: phase?.sequence ?? nextSequence,
      targetStartDate: phase?.targetStartDate ?? "",
      targetEndDate: phase?.targetEndDate ?? "",
      actualStartDate: phase?.actualStartDate ?? "",
      actualEndDate: phase?.actualEndDate ?? "",
      remarks: phase?.remarks ?? "",
    },
  });

  // Drives the soft "end ≥ start" calendar bound (the Zod superRefine is the real guard).
  const targetStart = useWatch({ control, name: "targetStartDate" });
  const actualStart = useWatch({ control, name: "actualStartDate" });

  function onSubmit(values: CreatePhaseInput) {
    start(async () => {
      const result = phase
        ? await updatePhaseAction({
            id: phase.id,
            name: values.name,
            sequence: values.sequence,
            targetStartDate: values.targetStartDate,
            targetEndDate: values.targetEndDate,
            actualStartDate: values.actualStartDate,
            actualEndDate: values.actualEndDate,
            remarks: values.remarks,
          })
        : await createPhaseAction(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(phase ? "Phase updated." : "Phase added.");
      router.refresh();
      onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-[1fr_6rem]">
        <div className="space-y-2">
          <Label htmlFor="phase-name" required>
            Phase name
          </Label>
          <Input
            id="phase-name"
            autoComplete="off"
            disabled={isPending}
            placeholder="e.g. Foundation works"
            {...register("name")}
          />
          <FieldError message={errors.name?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phase-sequence">Order</Label>
          <Input
            id="phase-sequence"
            type="number"
            min={0}
            inputMode="numeric"
            disabled={isPending}
            {...register("sequence")}
          />
          <FieldError message={errors.sequence?.message} />
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-muted-foreground text-xs font-medium">Schedule — target vs actual</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="phase-targetStartDate">Target start</Label>
            <Controller
              control={control}
              name="targetStartDate"
              render={({ field }) => (
                <DatePicker
                  id="phase-targetStartDate"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  disabled={isPending}
                  aria-label="Phase target start date"
                />
              )}
            />
            <FieldError message={errors.targetStartDate?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phase-targetEndDate">Target end</Label>
            <Controller
              control={control}
              name="targetEndDate"
              render={({ field }) => (
                <DatePicker
                  id="phase-targetEndDate"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  min={targetStart || undefined}
                  disabled={isPending}
                  aria-label="Phase target end date"
                />
              )}
            />
            <FieldError message={errors.targetEndDate?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phase-actualStartDate">Actual start</Label>
            <Controller
              control={control}
              name="actualStartDate"
              render={({ field }) => (
                <DatePicker
                  id="phase-actualStartDate"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  disabled={isPending}
                  aria-label="Phase actual start date"
                />
              )}
            />
            <FieldError message={errors.actualStartDate?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phase-actualEndDate">Actual end</Label>
            <Controller
              control={control}
              name="actualEndDate"
              render={({ field }) => (
                <DatePicker
                  id="phase-actualEndDate"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  min={actualStart || undefined}
                  disabled={isPending}
                  aria-label="Phase actual end date"
                />
              )}
            />
            <FieldError message={errors.actualEndDate?.message} />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="phase-remarks">Remarks</Label>
        <Textarea
          id="phase-remarks"
          rows={3}
          placeholder="Notes about this phase…"
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
              <Loader2 className="animate-spin" /> {phase ? "Saving…" : "Adding…"}
            </>
          ) : phase ? (
            "Save changes"
          ) : (
            "Add phase"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

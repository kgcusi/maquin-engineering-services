"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
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
  "id" | "name" | "sequence" | "startDate" | "targetEndDate" | "remarks"
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
      startDate: phase?.startDate ?? "",
      targetEndDate: phase?.targetEndDate ?? "",
      remarks: phase?.remarks ?? "",
    },
  });

  function onSubmit(values: CreatePhaseInput) {
    start(async () => {
      const result = phase
        ? await updatePhaseAction({
            id: phase.id,
            name: values.name,
            sequence: values.sequence,
            startDate: values.startDate,
            targetEndDate: values.targetEndDate,
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phase-startDate">Start date</Label>
          <Controller
            control={control}
            name="startDate"
            render={({ field }) => (
              <DatePicker
                id="phase-startDate"
                value={field.value ?? ""}
                onChange={field.onChange}
                disabled={isPending}
                aria-label="Phase start date"
              />
            )}
          />
          <FieldError message={errors.startDate?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phase-targetEndDate">Target end date</Label>
          <Controller
            control={control}
            name="targetEndDate"
            render={({ field }) => (
              <DatePicker
                id="phase-targetEndDate"
                value={field.value ?? ""}
                onChange={field.onChange}
                disabled={isPending}
                aria-label="Phase target end date"
              />
            )}
          />
          <FieldError message={errors.targetEndDate?.message} />
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

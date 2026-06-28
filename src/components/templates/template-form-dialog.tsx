"use client";

import { useRouter } from "next/navigation";
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type UseFormRegister,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { GripVertical, Layers, Loader2, Plus, Scale, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useProgressTransition } from "@/hooks/use-progress-transition";
import { cn } from "@/lib/utils";
import { createTemplateAction, updateTemplateAction } from "@/modules/projects/templates/actions";
import type { TemplateTree } from "@/modules/projects/templates/queries";
import { createTemplateSchema, type TemplateFormValues } from "@/modules/projects/templates/schema";

type FormShape = {
  name: string;
  description: string;
  isActive: boolean;
  phases: { name: string; durationDays: string; tasks: { name: string; weightPct: string }[] }[];
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-destructive text-xs">
      {message}
    </p>
  );
}

function emptyTask(): FormShape["phases"][number]["tasks"][number] {
  return { name: "", weightPct: "" };
}

function emptyPhase(): FormShape["phases"][number] {
  return { name: "", durationDays: "7", tasks: [emptyTask()] };
}

function toDefaults(template: TemplateTree | null): FormShape {
  if (!template) {
    return { name: "", description: "", isActive: true, phases: [emptyPhase()] };
  }
  return {
    name: template.name,
    description: template.description ?? "",
    isActive: template.isActive,
    phases: template.phases.map((p) => ({
      name: p.name,
      durationDays: String(p.durationDays),
      tasks: p.tasks.map((t) => ({ name: t.name, weightPct: String(t.weightPct) })),
    })),
  };
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: TemplateTree | null;
};

export function TemplateFormDialog({ open, onOpenChange, template }: Props) {
  const editing = Boolean(template);
  return (
    <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="p-4 pb-3">
          <DialogTitle>{editing ? "Edit template" : "New template"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Adjust the phases and tasks. Saved changes only affect projects created from here on — existing projects keep their copy."
              : "Lay out the phases and tasks once. New projects can spin up a full schedule from this skeleton."}
          </DialogDescription>
        </DialogHeader>
        <TemplateForm
          key={template?.id ?? "new"}
          template={template}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function TemplateForm({ template, onDone }: { template: TemplateTree | null; onDone: () => void }) {
  const router = useRouter();
  const [isPending, start] = useProgressTransition();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormShape>({
    // The Zod resolver coerces durationDays/weightPct from the string inputs.
    resolver: zodResolver(createTemplateSchema) as never,
    defaultValues: toDefaults(template),
  });

  const phases = useFieldArray({ control, name: "phases" });

  function onSubmit(values: FormShape) {
    const payload: TemplateFormValues = {
      name: values.name,
      description: values.description,
      isActive: values.isActive,
      phases: values.phases.map((p) => ({
        name: p.name,
        durationDays: p.durationDays,
        tasks: p.tasks.map((t) => ({ name: t.name, weightPct: t.weightPct })),
      })),
    };
    start(async () => {
      const result = template
        ? await updateTemplateAction({ ...payload, id: template.id })
        : await createTemplateAction(payload);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(template ? "Template updated." : "Template created.");
      router.refresh();
      onDone();
    });
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit as never)}
      className="flex min-h-0 flex-1 flex-col"
      noValidate
    >
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-1">
        <div className="space-y-2">
          <Label htmlFor="template-name" required>
            Template name
          </Label>
          <Input
            id="template-name"
            autoComplete="off"
            placeholder="e.g. Two-storey residential build"
            disabled={isPending}
            {...register("name")}
          />
          <FieldError message={errors.name?.message} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="template-description">Description</Label>
          <Textarea
            id="template-description"
            rows={2}
            placeholder="When to reach for this template…"
            disabled={isPending}
            {...register("description")}
          />
          <FieldError message={errors.description?.message} />
        </div>

        <Controller
          control={control}
          name="isActive"
          render={({ field }) => (
            <label className="bg-muted/30 flex cursor-pointer items-center justify-between gap-4 rounded-lg border px-3.5 py-3">
              <span className="space-y-0.5">
                <span className="block text-sm font-medium">Active</span>
                <span className="text-muted-foreground block text-xs">
                  Inactive templates stay editable but don&apos;t appear in the &ldquo;Start from
                  template&rdquo; picker.
                </span>
              </span>
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={isPending}
                aria-label="Active"
              />
            </label>
          )}
        />

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <Layers className="text-muted-foreground size-4" />
              <h3 className="text-sm font-medium">Phases</h3>
              <span className="text-muted-foreground text-xs tabular-nums">
                {phases.fields.length}
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => phases.append(emptyPhase())}
            >
              <Plus />
              Add phase
            </Button>
          </div>

          {typeof errors.phases?.message === "string" ? (
            <FieldError message={errors.phases.message} />
          ) : null}

          <ol className="space-y-3">
            {phases.fields.map((field, index) => (
              <PhaseEditor
                key={field.id}
                index={index}
                control={control}
                register={register}
                errors={errors}
                disabled={isPending}
                canRemove={phases.fields.length > 1}
                onRemove={() => phases.remove(index)}
              />
            ))}
          </ol>
        </div>
      </div>

      <DialogFooter className="mt-0 rounded-b-none border-t">
        <Button type="button" variant="outline" onClick={onDone} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> {template ? "Saving…" : "Creating…"}
            </>
          ) : template ? (
            "Save changes"
          ) : (
            "Create template"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

function PhaseEditor({
  index,
  control,
  register,
  errors,
  disabled,
  canRemove,
  onRemove,
}: {
  index: number;
  control: Control<FormShape>;
  register: UseFormRegister<FormShape>;
  errors: ReturnType<typeof useForm<FormShape>>["formState"]["errors"];
  disabled: boolean;
  canRemove: boolean;
  onRemove: () => void;
}) {
  const tasks = useFieldArray({ control, name: `phases.${index}.tasks` as const });
  const watchedTasks = useWatch({ control, name: `phases.${index}.tasks` });
  const phaseErrors = errors.phases?.[index];

  const allocated = (watchedTasks ?? []).reduce((sum, t) => sum + (Number(t?.weightPct) || 0), 0);
  const remaining = Math.round((100 - allocated) * 100) / 100;
  const over = allocated > 100.001;

  return (
    <li className="bg-card rounded-xl border">
      <div className="flex items-start gap-2 border-b p-3">
        <span className="text-muted-foreground bg-muted mt-1.5 flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold tabular-nums">
          {index + 1}
        </span>
        <div className="grid flex-1 gap-2 sm:grid-cols-[minmax(0,1fr)_7rem]">
          <div className="space-y-1.5">
            <Input
              placeholder="Phase name"
              aria-label={`Phase ${index + 1} name`}
              autoComplete="off"
              disabled={disabled}
              {...register(`phases.${index}.name` as const)}
            />
            <FieldError message={phaseErrors?.name?.message} />
          </div>
          <div className="space-y-1.5">
            <div className="relative">
              <Input
                type="number"
                min={1}
                inputMode="numeric"
                aria-label={`Phase ${index + 1} duration in days`}
                disabled={disabled}
                className="pr-12 text-right tabular-nums"
                {...register(`phases.${index}.durationDays` as const)}
              />
              <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs">
                days
              </span>
            </div>
            <FieldError message={phaseErrors?.durationDays?.message} />
          </div>
        </div>
        {canRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove phase ${index + 1}`}
            disabled={disabled}
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive mt-0.5 shrink-0"
          >
            <Trash2 />
          </Button>
        ) : (
          <span className="text-muted-foreground/40 mt-2 shrink-0" aria-hidden>
            <GripVertical className="size-4" />
          </span>
        )}
      </div>

      <div className="space-y-2 p-3">
        {tasks.fields.length > 0 ? (
          <ul className="space-y-2">
            {tasks.fields.map((task, ti) => (
              <li key={task.id} className="grid grid-cols-[minmax(0,1fr)_5.5rem_2rem] gap-2">
                <Input
                  placeholder="Task name"
                  aria-label={`Task ${ti + 1} in phase ${index + 1}`}
                  autoComplete="off"
                  disabled={disabled}
                  {...register(`phases.${index}.tasks.${ti}.name` as const)}
                />
                <div className="relative">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    inputMode="decimal"
                    aria-label={`Task ${ti + 1} weight percent`}
                    disabled={disabled}
                    className="pr-6 text-right tabular-nums"
                    {...register(`phases.${index}.tasks.${ti}.weightPct` as const)}
                  />
                  <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs">
                    %
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove task ${ti + 1}`}
                  disabled={disabled}
                  onClick={() => tasks.remove(ti)}
                  className="text-muted-foreground hover:text-destructive justify-self-end"
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground py-1 text-center text-xs italic">
            No tasks — this phase tracks as a single block of work.
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => tasks.append(emptyTask())}
            className="text-muted-foreground"
          >
            <Plus />
            Add task
          </Button>
          {tasks.fields.length > 0 ? (
            <span
              className={cn(
                "flex items-center gap-1.5 text-xs tabular-nums",
                over ? "text-destructive font-medium" : "text-muted-foreground",
              )}
            >
              <Scale className="size-3.5 shrink-0" />
              {over
                ? `Over by ${Math.round((allocated - 100) * 100) / 100}%`
                : `${Math.max(0, remaining)}% unallocated`}
            </span>
          ) : null}
        </div>
      </div>
    </li>
  );
}

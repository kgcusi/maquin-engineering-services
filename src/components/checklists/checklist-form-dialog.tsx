"use client";

import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { GripVertical, Loader2, Plus, Trash2 } from "lucide-react";
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
import {
  createChecklistAction,
  updateChecklistAction,
} from "@/modules/projects/inspections/checklists/actions";
import type { ChecklistTree } from "@/modules/projects/inspections/checklists/queries";
import {
  createChecklistSchema,
  type ChecklistFormValues,
  type CreateChecklistInput,
} from "@/modules/projects/inspections/checklists/schema";

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
  checklist?: ChecklistTree | null;
};

export function ChecklistFormDialog({ open, onOpenChange, checklist }: Props) {
  const editing = Boolean(checklist);
  return (
    <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit checklist" : "New checklist"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update the items a QA/QC engineer will run through."
              : "Build a reusable list of inspection items, grouped by category."}
          </DialogDescription>
        </DialogHeader>
        <ChecklistForm
          key={checklist?.id ?? "new"}
          checklist={checklist ?? null}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function ChecklistForm({
  checklist,
  onDone,
}: {
  checklist: ChecklistTree | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useProgressTransition();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ChecklistFormValues, unknown, CreateChecklistInput>({
    resolver: zodResolver(createChecklistSchema),
    defaultValues: {
      name: checklist?.name ?? "",
      category: checklist?.category ?? "",
      description: checklist?.description ?? "",
      isActive: checklist?.isActive ?? true,
      items: checklist?.items.length
        ? checklist.items.map((it) => ({ label: it.label, guidance: it.guidance ?? "" }))
        : [{ label: "", guidance: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  function onSubmit(values: CreateChecklistInput) {
    startTransition(async () => {
      const result = checklist
        ? await updateChecklistAction({ ...values, id: checklist.id })
        : await createChecklistAction(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(checklist ? "Checklist updated." : "Checklist created.");
      router.refresh();
      onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
        <div className="space-y-2">
          <Label htmlFor="name" required>
            Checklist name
          </Label>
          <Input
            id="name"
            autoComplete="off"
            placeholder="e.g. Concrete pour"
            disabled={isPending}
            {...register("name")}
          />
          <FieldError message={errors.name?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            autoComplete="off"
            placeholder="e.g. Structural"
            disabled={isPending}
            {...register("category")}
          />
          <FieldError message={errors.category?.message} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          rows={2}
          placeholder="When this checklist applies…"
          disabled={isPending}
          {...register("description")}
        />
        <FieldError message={errors.description?.message} />
      </div>

      <div className="space-y-3 rounded-lg border px-3.5 py-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Items</p>
            <p className="text-muted-foreground text-xs">
              Each line is marked Pass / Fail / N-A during an inspection.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => append({ label: "", guidance: "" })}
          >
            <Plus className="size-4" /> Add item
          </Button>
        </div>

        <div className="space-y-2">
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-start gap-2">
              <GripVertical className="text-muted-foreground mt-2.5 size-4 shrink-0" />
              <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_1fr]">
                <div className="space-y-1">
                  <Input
                    aria-label={`Item ${index + 1} label`}
                    placeholder="What to check"
                    autoComplete="off"
                    disabled={isPending}
                    {...register(`items.${index}.label` as const)}
                  />
                  <FieldError message={errors.items?.[index]?.label?.message} />
                </div>
                <Input
                  aria-label={`Item ${index + 1} guidance`}
                  placeholder="Guidance (optional)"
                  autoComplete="off"
                  disabled={isPending}
                  {...register(`items.${index}.guidance` as const)}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="mt-0.5"
                aria-label={`Remove item ${index + 1}`}
                disabled={isPending || fields.length === 1}
                onClick={() => remove(index)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        {typeof errors.items?.message === "string" ? (
          <FieldError message={errors.items.message} />
        ) : null}
      </div>

      <div className="flex items-center justify-between rounded-lg border px-3.5 py-3">
        <div className="space-y-0.5">
          <Label htmlFor="isActive">Active</Label>
          <p className="text-muted-foreground text-xs">
            Inactive checklists are hidden from the inspection picker.
          </p>
        </div>
        <Controller
          control={control}
          name="isActive"
          render={({ field }) => (
            <Switch
              id="isActive"
              checked={Boolean(field.value)}
              onCheckedChange={field.onChange}
              disabled={isPending}
            />
          )}
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> {checklist ? "Saving…" : "Creating…"}
            </>
          ) : checklist ? (
            "Save changes"
          ) : (
            "Create checklist"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

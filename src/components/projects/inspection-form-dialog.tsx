"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
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
import { Textarea } from "@/components/ui/textarea";
import { useProgressTransition } from "@/hooks/use-progress-transition";
import { requestInspectionAction } from "@/modules/projects/inspections/actions";
import {
  requestInspectionSchema,
  type RequestInspectionInput,
} from "@/modules/projects/inspections/schema";

type Option = { id: string; name: string };

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-destructive text-xs">
      {message}
    </p>
  );
}

export function InspectionFormDialog({
  open,
  onOpenChange,
  projectId,
  inspectors,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  inspectors: Option[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request inspection</DialogTitle>
          <DialogDescription>
            Ask a QA/QC engineer to inspect part of the work. They&apos;re notified and gain access
            to this project.
          </DialogDescription>
        </DialogHeader>
        <InspectionForm
          key={open ? "open" : "closed"}
          projectId={projectId}
          inspectors={inspectors}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function InspectionForm({
  projectId,
  inspectors,
  onDone,
}: {
  projectId: string;
  inspectors: Option[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [isPending, start] = useProgressTransition();
  const noInspectors = inspectors.length === 0;
  const inspectorItems = inspectors.map((i) => ({ value: i.id, label: i.name }));

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<RequestInspectionInput>({
    resolver: zodResolver(requestInspectionSchema),
    defaultValues: {
      projectId,
      title: "",
      area: "",
      description: "",
      inspectorId: "",
      scheduledFor: "",
    },
  });

  function onSubmit(values: RequestInspectionInput) {
    start(async () => {
      const result = await requestInspectionAction(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Inspection requested.");
      router.refresh();
      onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {noInspectors ? (
        <p className="text-muted-foreground rounded-lg border border-amber-500/30 bg-amber-500/5 px-3.5 py-3 text-xs">
          No QA/QC engineers exist yet. An admin can add one under Users (role “QA/QC Engineer”)
          before you can request an inspection.
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="inspection-title" required>
          What needs inspecting?
        </Label>
        <Input
          id="inspection-title"
          autoComplete="off"
          disabled={isPending}
          placeholder="e.g. 2nd floor slab rebar before pour"
          {...register("title")}
        />
        <FieldError message={errors.title?.message} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="inspection-inspector" required>
            QA/QC engineer
          </Label>
          <Controller
            control={control}
            name="inspectorId"
            render={({ field }) => (
              <Combobox
                items={inspectorItems}
                value={field.value || null}
                onValueChange={(v) => field.onChange(v ?? "")}
                placeholder="Select inspector"
                searchPlaceholder="Search QA/QC…"
                emptyText="No QA/QC engineers."
                disabled={isPending || noInspectors}
                aria-label="QA/QC engineer"
              />
            )}
          />
          <FieldError message={errors.inspectorId?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="inspection-scheduledFor">Target date</Label>
          <Controller
            control={control}
            name="scheduledFor"
            render={({ field }) => (
              <DatePicker
                id="inspection-scheduledFor"
                value={field.value ?? ""}
                onChange={field.onChange}
                disabled={isPending}
                aria-label="Target inspection date"
              />
            )}
          />
          <FieldError message={errors.scheduledFor?.message} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="inspection-area">Area / location</Label>
        <Input
          id="inspection-area"
          autoComplete="off"
          disabled={isPending}
          placeholder="e.g. Block B, Level 2"
          {...register("area")}
        />
        <FieldError message={errors.area?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="inspection-description">Details</Label>
        <Textarea
          id="inspection-description"
          rows={3}
          placeholder="What should the inspector check or look for?"
          disabled={isPending}
          {...register("description")}
        />
        <FieldError message={errors.description?.message} />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || noInspectors}>
          {isPending ? (
            <>
              <Loader2 className="animate-spin" /> Requesting…
            </>
          ) : (
            "Request inspection"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

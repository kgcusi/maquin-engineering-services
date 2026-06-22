"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { EngineerMultiSelect } from "@/components/projects/engineer-multiselect";
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
import { createProjectAction, updateProjectAction } from "@/modules/projects/actions";
import type { ProjectDetail } from "@/modules/projects/queries";
import {
  createProjectSchema,
  type CreateProjectFormValues,
  type CreateProjectInput,
} from "@/modules/projects/schema";

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
  project?: ProjectDetail | null;
  clients: Option[];
  engineers: Option[];
};

export function ProjectFormDialog({ open, onOpenChange, project, clients, engineers }: Props) {
  const editing = Boolean(project);
  return (
    <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit project" : "New project"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update this project's brief and team."
              : "Set up a project, assign a lead, and pull in the field team."}
          </DialogDescription>
        </DialogHeader>
        <ProjectForm
          key={project?.id ?? "new"}
          project={project ?? null}
          clients={clients}
          engineers={engineers}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function ProjectForm({
  project,
  clients,
  engineers,
  onDone,
}: {
  project: ProjectDetail | null;
  clients: Option[];
  engineers: Option[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useProgressTransition();

  const clientItems = clients.map((c) => ({ value: c.id, label: c.name }));
  const engineerItems = engineers.map((e) => ({ value: e.id, label: e.name }));

  const existingMembers = project?.members
    .filter((m) => m.roleOnProject === "MEMBER")
    .map((m) => m.userId);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CreateProjectFormValues, unknown, CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: project?.name ?? "",
      clientId: project?.clientId ?? "",
      location: project?.location ?? "",
      contractAmount: project?.contractAmount ?? "",
      startDate: project?.startDate ?? "",
      targetEndDate: project?.targetEndDate ?? "",
      scopeOfWork: project?.scopeOfWork ?? "",
      defectsLiabilityUntil: project?.defectsLiabilityUntil ?? "",
      leadEngineerId: project?.leadEngineerId ?? "",
      memberIds: existingMembers ?? [],
    },
  });

  const leadId = useWatch({ control, name: "leadEngineerId" });

  function onSubmit(values: CreateProjectInput) {
    startTransition(async () => {
      const result = project
        ? await updateProjectAction({ ...values, id: project.id })
        : await createProjectAction(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(project ? "Project updated." : "Project created.");
      router.refresh();
      onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="name" required>
          Project name
        </Label>
        <Input id="name" autoComplete="off" disabled={isPending} {...register("name")} />
        <FieldError message={errors.name?.message} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="clientId" required>
            Client
          </Label>
          <Controller
            control={control}
            name="clientId"
            render={({ field }) => (
              <Combobox
                items={clientItems}
                value={field.value || null}
                onValueChange={(v) => field.onChange(v ?? "")}
                placeholder="Select a client"
                searchPlaceholder="Search clients…"
                emptyText="No active clients."
                disabled={isPending}
                aria-label="Client"
              />
            )}
          />
          <FieldError message={errors.clientId?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input id="location" autoComplete="off" disabled={isPending} {...register("location")} />
          <FieldError message={errors.location?.message} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contractAmount">Contract amount</Label>
          <Input
            id="contractAmount"
            inputMode="decimal"
            placeholder="0.00"
            autoComplete="off"
            disabled={isPending}
            {...register("contractAmount")}
          />
          <FieldError message={errors.contractAmount?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="startDate">Start date</Label>
          <Controller
            control={control}
            name="startDate"
            render={({ field }) => (
              <DatePicker
                id="startDate"
                value={field.value ?? ""}
                onChange={field.onChange}
                disabled={isPending}
                aria-label="Start date"
              />
            )}
          />
          <FieldError message={errors.startDate?.message} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="targetEndDate">Target end date</Label>
          <Controller
            control={control}
            name="targetEndDate"
            render={({ field }) => (
              <DatePicker
                id="targetEndDate"
                value={field.value ?? ""}
                onChange={field.onChange}
                disabled={isPending}
                aria-label="Target end date"
              />
            )}
          />
          <FieldError message={errors.targetEndDate?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="defectsLiabilityUntil">Defects liability until</Label>
          <Controller
            control={control}
            name="defectsLiabilityUntil"
            render={({ field }) => (
              <DatePicker
                id="defectsLiabilityUntil"
                value={field.value ?? ""}
                onChange={field.onChange}
                disabled={isPending}
                aria-label="Defects liability until"
              />
            )}
          />
          <FieldError message={errors.defectsLiabilityUntil?.message} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="scopeOfWork">Scope of work</Label>
        <Textarea
          id="scopeOfWork"
          rows={3}
          placeholder="Summarize the deliverables and site scope…"
          disabled={isPending}
          {...register("scopeOfWork")}
        />
        <FieldError message={errors.scopeOfWork?.message} />
      </div>

      <div className="space-y-3 rounded-lg border px-3.5 py-3">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Team</p>
          <p className="text-muted-foreground text-xs">
            The lead engineer owns the site; members get scoped access to it. Both can be assigned
            later.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="leadEngineerId">Lead engineer</Label>
          <Controller
            control={control}
            name="leadEngineerId"
            render={({ field }) => (
              <Combobox
                items={engineerItems}
                value={field.value || null}
                onValueChange={(v) => field.onChange(v ?? "")}
                placeholder="Select a lead"
                searchPlaceholder="Search engineers…"
                emptyText="No engineers available."
                disabled={isPending}
                aria-label="Lead engineer"
              />
            )}
          />
          <FieldError message={errors.leadEngineerId?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="memberIds">Team members</Label>
          <Controller
            control={control}
            name="memberIds"
            render={({ field }) => (
              <EngineerMultiSelect
                id="memberIds"
                options={engineers}
                value={field.value ?? []}
                onChange={field.onChange}
                excludeId={leadId || null}
                disabled={isPending}
              />
            )}
          />
          <FieldError message={errors.memberIds?.message} />
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> {project ? "Saving…" : "Creating…"}
            </>
          ) : project ? (
            "Save changes"
          ) : (
            "Create project"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

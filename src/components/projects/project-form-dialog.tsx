"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ShieldCheck, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { EngineerMultiSelect } from "@/components/projects/engineer-multiselect";
import {
  seedEditableTasks,
  TemplateScheduleReview,
  type EditableTask,
  type PhaseDurationState,
} from "@/components/templates/template-schedule-review";
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
import { isPhaseOverAllocated, phaseWeightTotal } from "@/modules/projects/templates/domain";
import type { TemplateTree } from "@/modules/projects/templates/queries";
import {
  createProjectSchema,
  type CreateProjectFormValues,
  type CreateProjectInput,
} from "@/modules/projects/schema";

type Option = { id: string; name: string };

// Sentinel for the "no template" choice in the picker (empty value collapses the
// review panel and omits the `template` payload on submit).
const BLANK = "__blank__";

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
  templates?: TemplateTree[];
};

export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
  clients,
  engineers,
  templates = [],
}: Props) {
  const editing = Boolean(project);
  return (
    <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="p-4 pb-3">
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
          templates={templates}
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
  templates,
  onDone,
}: {
  project: ProjectDetail | null;
  clients: Option[];
  engineers: Option[];
  templates: TemplateTree[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useProgressTransition();

  // Template seeding is a NEW-project-only affordance, kept in local state (it isn't
  // a project schema field — only the assembled `template` object joins the payload).
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [durations, setDurations] = useState<PhaseDurationState[]>([]);
  const [tasksByPhase, setTasksByPhase] = useState<Record<string, EditableTask[]>>({});
  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === templateId) ?? null,
    [templates, templateId],
  );

  function chooseTemplate(value: string | null) {
    if (!value || value === BLANK) {
      setTemplateId(null);
      setDurations([]);
      setTasksByPhase({}); // tasks are keyed by phase id — never leak across templates
      return;
    }
    const next = templates.find((t) => t.id === value);
    setTemplateId(value);
    setDurations(
      next ? next.phases.map((p) => ({ templatePhaseId: p.id, durationDays: p.durationDays })) : [],
    );
    setTasksByPhase(next ? seedEditableTasks(next) : {});
  }

  function setPhaseDuration(templatePhaseId: string, durationDays: number) {
    setDurations((prev) =>
      prev.map((d) => (d.templatePhaseId === templatePhaseId ? { ...d, durationDays } : d)),
    );
  }

  function setPhaseTasks(templatePhaseId: string, tasks: EditableTask[]) {
    setTasksByPhase((prev) => ({ ...prev, [templatePhaseId]: tasks }));
  }

  const templateItems = [
    { value: BLANK, label: "Blank project" },
    ...templates.map((t) => ({ value: t.id, label: t.name })),
  ];

  const clientItems = clients.map((c) => ({ value: c.id, label: c.name }));
  const engineerItems = engineers.map((e) => ({ value: e.id, label: e.name }));

  const existingMembers = project?.members
    .filter((m) => m.roleOnProject === "MEMBER")
    .map((m) => m.userId);

  // Inspectors join via inspection requests, not this picker, so they're not in the
  // member multiselect. Surface them read-only so editing a project doesn't read as
  // if they were dropped from the team.
  const inspectors = project?.members.filter((m) => m.roleOnProject === "INSPECTOR") ?? [];

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
  const startDate = useWatch({ control, name: "startDate" }) ?? "";
  // A chosen template requires a start date to anchor the chain (the action rejects
  // otherwise); block submit until one is set rather than surfacing a server error.
  const templateNeedsStart =
    !project && selectedTemplate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(startDate);
  // Block submit if any phase's task weights top 100% — the server rejects it too,
  // but disabling is clearer.
  const templateOverAllocated =
    !project && selectedTemplate
      ? selectedTemplate.phases.some((p) =>
          isPhaseOverAllocated(
            phaseWeightTotal((tasksByPhase[p.id] ?? []).map((t) => t.weightPct)),
          ),
        )
      : false;

  function onSubmit(values: CreateProjectInput) {
    const template =
      !project && selectedTemplate
        ? {
            templateId: selectedTemplate.id,
            phases: durations.map((d) => ({
              templatePhaseId: d.templatePhaseId,
              durationDays: d.durationDays,
              tasks: (tasksByPhase[d.templatePhaseId] ?? [])
                .map((t) => ({ name: t.name.trim(), weightPct: t.weightPct }))
                .filter((t) => t.name.length > 0),
            })),
          }
        : undefined;

    startTransition(async () => {
      const result = project
        ? await updateProjectAction({ ...values, id: project.id })
        : await createProjectAction({ ...values, template });
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
    <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col" noValidate>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-1">
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
            <Input
              id="location"
              autoComplete="off"
              disabled={isPending}
              {...register("location")}
            />
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

        {!project && templates.length > 0 ? (
          <div className="space-y-3 rounded-lg border px-3.5 py-3">
            <div className="flex items-center gap-1.5">
              <Wand2 className="text-muted-foreground size-4" />
              <p className="text-sm font-medium">Start from template</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="templatePicker" className="text-muted-foreground text-xs font-normal">
                Seed phases &amp; tasks from a saved skeleton, or start blank.
              </Label>
              <Combobox
                items={templateItems}
                value={templateId ?? BLANK}
                onValueChange={chooseTemplate}
                placeholder="Blank project"
                searchPlaceholder="Search templates…"
                emptyText="No active templates."
                disabled={isPending}
                aria-label="Project template"
                className="w-full"
              />
            </div>

            {selectedTemplate ? (
              <TemplateScheduleReview
                template={selectedTemplate}
                startDate={startDate}
                durations={durations}
                onDurationChange={setPhaseDuration}
                tasksByPhase={tasksByPhase}
                onTasksChange={setPhaseTasks}
                disabled={isPending}
              />
            ) : null}
          </div>
        ) : null}

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

          {inspectors.length > 0 ? (
            <div className="rounded-md border border-dashed px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-xs font-medium">
                <ShieldCheck className="size-3.5 text-emerald-600" />
                QA / QC inspectors
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                {inspectors.map((m) => m.name).join(", ")} — granted access through inspection
                requests. They stay on the team and aren&apos;t managed here.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <DialogFooter className="mt-0 rounded-b-none border-t">
        <Button type="button" variant="outline" onClick={onDone} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || templateNeedsStart || templateOverAllocated}>
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

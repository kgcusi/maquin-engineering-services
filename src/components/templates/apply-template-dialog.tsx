"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";

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
import { Label } from "@/components/ui/label";
import { useProgressTransition } from "@/hooks/use-progress-transition";
import { applyTemplateToProjectAction } from "@/modules/projects/templates/actions";
import { isPhaseOverAllocated, phaseWeightTotal } from "@/modules/projects/templates/domain";
import type { TemplateTree } from "@/modules/projects/templates/queries";

export function ApplyTemplateDialog({
  open,
  onOpenChange,
  projectId,
  templates,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  templates: TemplateTree[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="p-4 pb-3">
          <DialogTitle>Apply a template</DialogTitle>
          <DialogDescription>
            Pick a skeleton and a start date — its phases and tasks land on this project, scheduled
            from that date. Available only while the project has no phases.
          </DialogDescription>
        </DialogHeader>
        <ApplyForm
          key={open ? "open" : "closed"}
          projectId={projectId}
          templates={templates}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function ApplyForm({
  projectId,
  templates,
  onDone,
}: {
  projectId: string;
  templates: TemplateTree[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [isPending, start] = useProgressTransition();

  const [templateId, setTemplateId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [durations, setDurations] = useState<PhaseDurationState[]>([]);
  const [tasksByPhase, setTasksByPhase] = useState<Record<string, EditableTask[]>>({});

  const selected = useMemo(
    () => templates.find((t) => t.id === templateId) ?? null,
    [templates, templateId],
  );
  const templateItems = templates.map((t) => ({ value: t.id, label: t.name }));
  const hasStart = /^\d{4}-\d{2}-\d{2}$/.test(startDate);
  // Mirror the create flow: block apply when a phase's task weights top 100%.
  const overAllocated = selected
    ? selected.phases.some((p) =>
        isPhaseOverAllocated(phaseWeightTotal((tasksByPhase[p.id] ?? []).map((t) => t.weightPct))),
      )
    : false;

  function chooseTemplate(value: string | null) {
    const next = value ? (templates.find((t) => t.id === value) ?? null) : null;
    setTemplateId(value);
    setDurations(
      next ? next.phases.map((p) => ({ templatePhaseId: p.id, durationDays: p.durationDays })) : [],
    );
    setTasksByPhase(next ? seedEditableTasks(next) : {}); // keyed by phase id — never leak across templates
  }

  function setPhaseDuration(templatePhaseId: string, durationDays: number) {
    setDurations((prev) =>
      prev.map((d) => (d.templatePhaseId === templatePhaseId ? { ...d, durationDays } : d)),
    );
  }

  function setPhaseTasks(templatePhaseId: string, tasks: EditableTask[]) {
    setTasksByPhase((prev) => ({ ...prev, [templatePhaseId]: tasks }));
  }

  function onSubmit() {
    if (!selected || !hasStart) return;
    start(async () => {
      const result = await applyTemplateToProjectAction({
        projectId,
        templateId: selected.id,
        startDate,
        phases: durations.map((d) => ({
          templatePhaseId: d.templatePhaseId,
          durationDays: d.durationDays,
          tasks: (tasksByPhase[d.templatePhaseId] ?? [])
            .map((t) => ({ name: t.name.trim(), weightPct: t.weightPct }))
            .filter((t) => t.name.length > 0),
        })),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Added ${result.data.phaseCount} ${result.data.phaseCount === 1 ? "phase" : "phases"} and ${result.data.taskCount} ${result.data.taskCount === 1 ? "task" : "tasks"}.`,
      );
      router.refresh();
      onDone();
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-1">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="apply-template">Template</Label>
            <Combobox
              items={templateItems}
              value={templateId}
              onValueChange={chooseTemplate}
              placeholder="Select a template"
              searchPlaceholder="Search templates…"
              emptyText="No active templates."
              disabled={isPending}
              aria-label="Template"
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="apply-start">Start date</Label>
            <DatePicker
              id="apply-start"
              value={startDate}
              onChange={setStartDate}
              disabled={isPending}
              aria-label="Start date"
            />
          </div>
        </div>

        {selected ? (
          <TemplateScheduleReview
            template={selected}
            startDate={startDate}
            durations={durations}
            onDurationChange={setPhaseDuration}
            tasksByPhase={tasksByPhase}
            onTasksChange={setPhaseTasks}
            disabled={isPending}
          />
        ) : (
          <p className="text-muted-foreground flex items-center gap-2 rounded-lg border border-dashed px-3.5 py-6 text-sm">
            <Wand2 className="size-4 shrink-0" />
            Choose a template to preview its phases and schedule.
          </p>
        )}
      </div>

      <DialogFooter className="mt-0 rounded-b-none border-t">
        <Button type="button" variant="outline" onClick={onDone} disabled={isPending}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={onSubmit}
          disabled={isPending || !selected || !hasStart || overAllocated}
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Applying…
            </>
          ) : (
            "Apply template"
          )}
        </Button>
      </DialogFooter>
    </div>
  );
}

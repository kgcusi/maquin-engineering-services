"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Controller,
  useFieldArray,
  useForm,
  type Control,
  type UseFormRegister,
} from "react-hook-form";
import {
  Camera,
  CheckCircle2,
  ChevronDown,
  CloudSun,
  HardHat,
  Loader2,
  Lock,
  Package,
  Plus,
  RotateCcw,
  Send,
  Trash2,
  TriangleAlert,
  Truck,
} from "lucide-react";
import { toast } from "sonner";

import { DsrPhotoPanel } from "@/components/projects/dsr/dsr-photo-panel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useProgressTransition } from "@/hooks/use-progress-transition";
import { TRADES, UNITS } from "@/lib/lookups";
import { DSR_ISSUE_SEVERITIES, dsrIssueSeverityLabel } from "@/lib/statuses";
import { cn } from "@/lib/utils";
import {
  reopenDsrAction,
  saveDsrDraftAction,
  submitDsrAction,
} from "@/modules/projects/dsr/actions";
import type { DsrEditor as DsrEditorData } from "@/modules/projects/dsr/queries";
import type { AttachmentRow } from "@/modules/files/service";
import type { Paginated } from "@/modules/shared/list-params";

const TRADE_ITEMS = TRADES.map((t) => ({ value: t.code, label: t.label }));
const UNIT_ITEMS = UNITS.map((u) => ({ value: u.code, label: u.label }));

const AUTOSAVE_DELAY = 1200;

// ── Form value shapes — numeric fields stay strings for the inputs; the autosave
// payload coerces them (the action validates with z.coerce). ──────────────────
type ManpowerRow = { tradeCode: string; headcount: string; hours: string };
type EquipmentRow = { name: string; quantity: string; hours: string; remarks: string };
type MaterialRow = { description: string; quantity: string; unitCode: string };
type IssueRow = { description: string; severity: string; resolved: boolean };

type FormValues = {
  weather: string;
  workAccomplished: string;
  nextDayPlan: string;
  progressNote: string;
  manpower: ManpowerRow[];
  equipment: EquipmentRow[];
  materials: MaterialRow[];
  issues: IssueRow[];
};

function toFormValues(dsr: DsrEditorData): FormValues {
  const numStr = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));
  return {
    weather: dsr.weather ?? "",
    workAccomplished: dsr.workAccomplished ?? "",
    nextDayPlan: dsr.nextDayPlan ?? "",
    progressNote: dsr.progressNote ?? "",
    manpower: dsr.manpower.map((m) => ({
      tradeCode: m.tradeCode ?? "",
      headcount: numStr(m.headcount) || "1",
      hours: numStr(m.hours),
    })),
    equipment: dsr.equipment.map((e) => ({
      name: e.name,
      quantity: numStr(e.quantity) || "1",
      hours: numStr(e.hours),
      remarks: e.remarks ?? "",
    })),
    materials: dsr.materials.map((m) => ({
      description: m.description ?? "",
      quantity: numStr(m.quantity) || "1",
      unitCode: m.unitCode ?? "",
    })),
    issues: dsr.issues.map((i) => ({
      description: i.description,
      severity: i.severity,
      resolved: i.resolved,
    })),
  };
}

const numOrEmpty = (v: string) => {
  const t = v.trim();
  if (t === "") return "" as const;
  const n = Number(t);
  return Number.isFinite(n) ? n : ("" as const);
};

// The serializable payload the autosave sends (action input is `unknown`).
function toPayload(id: string, v: FormValues) {
  return {
    id,
    weather: v.weather.trim(),
    workAccomplished: v.workAccomplished.trim(),
    nextDayPlan: v.nextDayPlan.trim(),
    progressNote: v.progressNote.trim(),
    manpower: v.manpower.map((m) => ({
      tradeCode: m.tradeCode,
      headcount: Number(m.headcount) || 1,
      hours: numOrEmpty(m.hours),
    })),
    equipment: v.equipment.map((e) => ({
      name: e.name.trim(),
      quantity: Number(e.quantity) || 0,
      hours: numOrEmpty(e.hours),
      remarks: e.remarks.trim(),
    })),
    materials: v.materials.map((m) => ({
      description: m.description.trim(),
      quantity: Number(m.quantity) || 0,
      unitCode: m.unitCode,
    })),
    issues: v.issues.map((i) => ({
      description: i.description.trim(),
      severity: i.severity,
      resolved: i.resolved,
    })),
  };
}

// ── Section shell — a collapsible card with an icon, title, and count ─────────
function Section({
  icon: Icon,
  title,
  count,
  children,
  defaultOpen = true,
}: {
  icon: typeof HardHat;
  title: string;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="overflow-hidden rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="bg-muted/30 hover:bg-muted/40 flex w-full items-center gap-2.5 border-b px-4 py-3 text-left transition-colors"
        aria-expanded={open}
      >
        <span className="bg-background text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-md border">
          <Icon className="size-3.5" />
        </span>
        <span className="text-sm font-semibold tracking-tight">{title}</span>
        {count > 0 ? (
          <span className="text-muted-foreground text-xs tabular-nums">{count}</span>
        ) : null}
        <ChevronDown
          className={cn(
            "text-muted-foreground ml-auto size-4 shrink-0 transition-transform",
            !open && "-rotate-90",
          )}
        />
      </button>
      {open ? <div className="p-4">{children}</div> : null}
    </section>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-6 text-center text-sm">
      {label}
    </p>
  );
}

function RemoveButton({
  onClick,
  label,
  className,
}: {
  onClick: () => void;
  label: string;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      onClick={onClick}
      className={cn("text-muted-foreground hover:text-destructive shrink-0", className)}
    >
      <Trash2 />
    </Button>
  );
}

// A repeatable line-item row. Mobile-first: a bordered card with each field stacked
// full-width (its own label) and the remove control pinned to the top-right; on sm+
// it flattens to a borderless inline grid (`cols`), with the remove button sitting
// in the trailing `auto` column aligned to the inputs.
function RowShell({
  cols,
  onRemove,
  removeLabel,
  children,
}: {
  cols: string;
  onRemove: () => void;
  removeLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative rounded-lg border p-3 pt-9 sm:grid sm:items-end sm:gap-2 sm:rounded-none sm:border-0 sm:p-0 sm:pt-0",
        "space-y-2.5 sm:space-y-0",
        cols,
      )}
    >
      {children}
      <RemoveButton
        label={removeLabel}
        onClick={onRemove}
        className="absolute top-1.5 right-1.5 sm:static sm:top-auto sm:right-auto"
      />
    </div>
  );
}

// Read-only renderers — used when !canEdit so the field shows its value without an
// editable control (no autosave, no add/remove).
function ReadField({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-sm whitespace-pre-wrap">
        {value?.trim() ? value : <span className="text-muted-foreground">—</span>}
      </p>
    </div>
  );
}

export function DsrEditor({
  dsr,
  photos,
  timeZone,
  canEdit,
  canReopen,
}: {
  dsr: DsrEditorData;
  photos: Paginated<AttachmentRow>;
  timeZone: string;
  canEdit: boolean;
  canReopen: boolean;
}) {
  if (!canEdit) {
    return <DsrReadOnly dsr={dsr} photos={photos} timeZone={timeZone} canReopen={canReopen} />;
  }
  return <DsrForm dsr={dsr} photos={photos} timeZone={timeZone} />;
}

// ── Editable form (DRAFT, author or admin) ────────────────────────────────────
type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: Date }
  | { kind: "error" };

function DsrForm({
  dsr,
  photos,
  timeZone,
}: {
  dsr: DsrEditorData;
  photos: Paginated<AttachmentRow>;
  timeZone: string;
}) {
  const router = useRouter();
  const { register, control, watch, getValues } = useForm<FormValues>({
    defaultValues: useMemo(() => toFormValues(dsr), [dsr]),
  });

  const manpower = useFieldArray({ control, name: "manpower" });
  const equipment = useFieldArray({ control, name: "equipment" });
  const materials = useFieldArray({ control, name: "materials" });
  const issues = useFieldArray({ control, name: "issues" });

  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [isSubmitting, startSubmit] = useProgressTransition();

  // Autosave plumbing: a debounce timer, an in-flight guard, and a "dirty while
  // saving" flag so the latest edit is flushed after the current save resolves.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const queued = useRef(false);

  const runSave = useCallback(async () => {
    if (inFlight.current) {
      queued.current = true;
      return;
    }
    inFlight.current = true;
    setSaveState({ kind: "saving" });
    const result = await saveDsrDraftAction(toPayload(dsr.id, getValues()));
    inFlight.current = false;
    if (!result.ok) {
      setSaveState({ kind: "error" });
    } else {
      setSaveState({ kind: "saved", at: new Date() });
    }
    if (queued.current) {
      queued.current = false;
      void runSave();
    }
  }, [dsr.id, getValues]);

  const scheduleSave = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void runSave(), AUTOSAVE_DELAY);
  }, [runSave]);

  // Watch every field; skip the initial mount emission (RHF fires once on subscribe).
  const mounted = useRef(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/incompatible-library
    const sub = watch(() => {
      if (!mounted.current) return;
      scheduleSave();
    });
    mounted.current = true;
    return () => sub.unsubscribe();
  }, [watch, scheduleSave]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  // Adding/removing a field-array row mutates outside the input change stream, so
  // nudge a save explicitly after structural edits.
  const afterStructural = () => scheduleSave();

  function submit() {
    startSubmit(async () => {
      // Flush any pending edits first so the server validates the latest text.
      if (timer.current) clearTimeout(timer.current);
      await saveDsrDraftAction(toPayload(dsr.id, getValues()));
      const result = await submitDsrAction({ id: dsr.id });
      if (!result.ok) {
        toast.error(result.error);
        setConfirmSubmit(false);
        return;
      }
      toast.success("Daily report submitted.");
      router.push(`/projects/${dsr.projectId}?tab=reports`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <SaveIndicator state={saveState} timeZone={timeZone} />

      {/* Header card */}
      <div className="space-y-4 rounded-lg border p-4">
        <div className="space-y-2">
          <Label htmlFor="dsr-weather" className="gap-1.5">
            <CloudSun className="text-muted-foreground size-4" /> Weather
          </Label>
          <Input
            id="dsr-weather"
            placeholder="e.g. Sunny, brief rain after lunch"
            maxLength={120}
            {...register("weather")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dsr-work" required>
            Work accomplished
          </Label>
          <Textarea
            id="dsr-work"
            rows={4}
            placeholder="What was completed on site today…"
            {...register("workAccomplished")}
          />
          <p className="text-muted-foreground text-xs">Required before you can submit.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="dsr-next">Next-day plan</Label>
            <Textarea
              id="dsr-next"
              rows={3}
              placeholder="Planned for tomorrow…"
              {...register("nextDayPlan")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dsr-progress">Progress note</Label>
            <Textarea
              id="dsr-progress"
              rows={3}
              placeholder="Notes on overall progress…"
              {...register("progressNote")}
            />
          </div>
        </div>
      </div>

      {/* Manpower */}
      <Section icon={HardHat} title="Manpower" count={manpower.fields.length}>
        <div className="space-y-2.5">
          {manpower.fields.length === 0 ? (
            <EmptyRow label="No manpower logged. Add a trade and headcount." />
          ) : (
            <div className="space-y-2.5">
              {manpower.fields.map((field, i) => (
                <RowShell
                  key={field.id}
                  cols="sm:grid-cols-[minmax(0,1.6fr)_minmax(0,5rem)_minmax(0,5rem)_auto]"
                  onRemove={() => {
                    manpower.remove(i);
                    afterStructural();
                  }}
                  removeLabel="Remove manpower row"
                >
                  <ComboField
                    control={control}
                    name={`manpower.${i}.tradeCode` as const}
                    items={TRADE_ITEMS}
                    placeholder="Select trade"
                    searchPlaceholder="Search trades…"
                    emptyText="No matching trade."
                    label="Trade"
                    showLabel={i === 0}
                  />
                  <NumField
                    register={register}
                    name={`manpower.${i}.headcount` as const}
                    label="Count"
                    showLabel={i === 0}
                    min={1}
                  />
                  <NumField
                    register={register}
                    name={`manpower.${i}.hours` as const}
                    label="Hours"
                    showLabel={i === 0}
                    placeholder="—"
                  />
                </RowShell>
              ))}
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => manpower.append({ tradeCode: "", headcount: "1", hours: "" })}
          >
            <Plus /> Add trade
          </Button>
        </div>
      </Section>

      {/* Equipment */}
      <Section icon={Truck} title="Equipment" count={equipment.fields.length}>
        <div className="space-y-2.5">
          {equipment.fields.length === 0 ? (
            <EmptyRow label="No equipment logged. Add machines or tools on site." />
          ) : (
            <div className="space-y-2.5">
              {equipment.fields.map((field, i) => (
                <RowShell
                  key={field.id}
                  cols="sm:grid-cols-[minmax(0,1.4fr)_minmax(0,4.5rem)_minmax(0,4.5rem)_minmax(0,1.4fr)_auto]"
                  onRemove={() => {
                    equipment.remove(i);
                    afterStructural();
                  }}
                  removeLabel="Remove equipment row"
                >
                  <TextField
                    register={register}
                    name={`equipment.${i}.name` as const}
                    label="Equipment"
                    showLabel={i === 0}
                    placeholder="e.g. Excavator"
                  />
                  <NumField
                    register={register}
                    name={`equipment.${i}.quantity` as const}
                    label="Qty"
                    showLabel={i === 0}
                    min={0}
                  />
                  <NumField
                    register={register}
                    name={`equipment.${i}.hours` as const}
                    label="Hours"
                    showLabel={i === 0}
                    placeholder="—"
                  />
                  <TextField
                    register={register}
                    name={`equipment.${i}.remarks` as const}
                    label="Remarks"
                    showLabel={i === 0}
                    placeholder="Optional"
                  />
                </RowShell>
              ))}
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => equipment.append({ name: "", quantity: "1", hours: "", remarks: "" })}
          >
            <Plus /> Add equipment
          </Button>
        </div>
      </Section>

      {/* Materials */}
      <Section icon={Package} title="Materials" count={materials.fields.length}>
        <div className="space-y-2.5">
          {materials.fields.length === 0 ? (
            <EmptyRow label="No materials logged. Record what was delivered or used." />
          ) : (
            <div className="space-y-2.5">
              {materials.fields.map((field, i) => (
                <RowShell
                  key={field.id}
                  cols="sm:grid-cols-[minmax(0,1.8fr)_minmax(0,5rem)_minmax(0,8rem)_auto]"
                  onRemove={() => {
                    materials.remove(i);
                    afterStructural();
                  }}
                  removeLabel="Remove material row"
                >
                  <TextField
                    register={register}
                    name={`materials.${i}.description` as const}
                    label="Material"
                    showLabel={i === 0}
                    placeholder="e.g. Portland cement"
                  />
                  <NumField
                    register={register}
                    name={`materials.${i}.quantity` as const}
                    label="Qty"
                    showLabel={i === 0}
                    min={0}
                  />
                  <ComboField
                    control={control}
                    name={`materials.${i}.unitCode` as const}
                    items={UNIT_ITEMS}
                    placeholder="Unit"
                    searchPlaceholder="Search units…"
                    emptyText="No matching unit."
                    label="Unit"
                    showLabel={i === 0}
                  />
                </RowShell>
              ))}
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => materials.append({ description: "", quantity: "1", unitCode: "" })}
          >
            <Plus /> Add material
          </Button>
        </div>
      </Section>

      {/* Issues */}
      <Section icon={TriangleAlert} title="Site issues" count={issues.fields.length}>
        <div className="space-y-3">
          {issues.fields.length === 0 ? (
            <EmptyRow label="No issues logged. Flag delays, safety, or quality concerns here." />
          ) : (
            <div className="space-y-3">
              {issues.fields.map((field, i) => (
                <div key={field.id} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-start gap-2">
                    <Textarea
                      rows={2}
                      placeholder="Describe the issue…"
                      aria-label="Issue description"
                      className="flex-1"
                      {...register(`issues.${i}.description` as const)}
                    />
                    <RemoveButton
                      label="Remove issue"
                      onClick={() => {
                        issues.remove(i);
                        afterStructural();
                      }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <SeverityField control={control} name={`issues.${i}.severity` as const} />
                    <ResolvedField
                      control={control}
                      name={`issues.${i}.resolved` as const}
                      index={i}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => issues.append({ description: "", severity: "LOW", resolved: false })}
          >
            <Plus /> Add issue
          </Button>
        </div>
      </Section>

      {/* Photos */}
      <Section
        icon={Camera}
        title="Site photos"
        count={photos.total}
        defaultOpen={photos.total > 0}
      >
        <DsrPhotoPanel dsrId={dsr.id} photos={photos} timeZone={timeZone} canEdit />
      </Section>

      {/* Submit */}
      <div className="bg-background/80 sticky bottom-0 -mx-1 flex flex-col gap-2 border-t pt-4 pb-1 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-xs">
          Autosaves as you type. Submit when the day&apos;s work is logged.
        </p>
        <Button onClick={() => setConfirmSubmit(true)} disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin" /> Submitting…
            </>
          ) : (
            <>
              <Send /> Submit report
            </>
          )}
        </Button>
      </div>

      <AlertDialog
        open={confirmSubmit}
        onOpenChange={(open) => {
          if (!open && !isSubmitting) setConfirmSubmit(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit this daily report?</AlertDialogTitle>
            <AlertDialogDescription>
              Once submitted, only an admin can re-open it for changes. Make sure today&apos;s log
              is complete.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={submit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" /> Submitting…
                </>
              ) : (
                "Submit report"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function formatClock(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(undefined, { timeStyle: "short", timeZone }).format(at);
}

// ── Autosave status pill ──────────────────────────────────────────────────────
function SaveIndicator({ state, timeZone }: { state: SaveState; timeZone: string }) {
  if (state.kind === "error") {
    return (
      <div className="flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-700 dark:border-amber-400/30 dark:text-amber-400">
        <TriangleAlert className="size-3.5 shrink-0" />
        Couldn&apos;t save your latest change. Your input is safe — keep editing and we&apos;ll
        retry.
      </div>
    );
  }
  return (
    <div className="text-muted-foreground flex h-6 items-center gap-1.5 text-xs">
      {state.kind === "saving" ? (
        <>
          <Loader2 className="size-3.5 animate-spin" /> Saving…
        </>
      ) : state.kind === "saved" ? (
        <>
          <CheckCircle2 className="size-3.5 text-emerald-500" /> Saved ·{" "}
          <span className="tabular-nums">{formatClock(state.at, timeZone)}</span>
        </>
      ) : (
        <span className="text-muted-foreground/70">Changes save automatically.</span>
      )}
    </div>
  );
}

// ── Field-array cells ─────────────────────────────────────────────────────────
// Labels always show on mobile (one per stacked field); on sm+ the row collapses
// to a grid and only the first row keeps a header label, so the table reads clean.
function CellLabel({ text, show }: { text: string; show: boolean }) {
  return (
    <span className={cn("text-muted-foreground mb-1 block text-xs", show ? "" : "sm:hidden")}>
      {text}
    </span>
  );
}

function TextField({
  register,
  name,
  label,
  showLabel,
  placeholder,
}: {
  register: UseFormRegister<FormValues>;
  name: Parameters<UseFormRegister<FormValues>>[0];
  label: string;
  showLabel: boolean;
  placeholder?: string;
}) {
  return (
    <div className="min-w-0">
      <CellLabel text={label} show={showLabel} />
      <Input placeholder={placeholder} aria-label={label} {...register(name)} />
    </div>
  );
}

function NumField({
  register,
  name,
  label,
  showLabel,
  min,
  placeholder,
}: {
  register: UseFormRegister<FormValues>;
  name: Parameters<UseFormRegister<FormValues>>[0];
  label: string;
  showLabel: boolean;
  min?: number;
  placeholder?: string;
}) {
  return (
    <div className="min-w-0">
      <CellLabel text={label} show={showLabel} />
      <Input
        type="number"
        inputMode="decimal"
        min={min}
        placeholder={placeholder}
        aria-label={label}
        className="text-right tabular-nums"
        {...register(name)}
      />
    </div>
  );
}

function ComboField({
  control,
  name,
  items,
  placeholder,
  searchPlaceholder,
  emptyText,
  label,
  showLabel,
}: {
  control: Control<FormValues>;
  name: Parameters<UseFormRegister<FormValues>>[0];
  items: { value: string; label: string }[];
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  label: string;
  showLabel: boolean;
}) {
  return (
    <div className="min-w-0">
      <CellLabel text={label} show={showLabel} />
      <ControllerCombobox
        control={control}
        name={name}
        items={items}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        emptyText={emptyText}
        label={label}
      />
    </div>
  );
}

function ControllerCombobox({
  control,
  name,
  items,
  placeholder,
  searchPlaceholder,
  emptyText,
  label,
}: {
  control: Control<FormValues>;
  name: Parameters<UseFormRegister<FormValues>>[0];
  items: { value: string; label: string }[];
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  label: string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Combobox
          items={items}
          value={(field.value as string) || null}
          onValueChange={(v) => field.onChange(v ?? "")}
          placeholder={placeholder}
          searchPlaceholder={searchPlaceholder}
          emptyText={emptyText}
          aria-label={label}
        />
      )}
    />
  );
}

function SeverityField({
  control,
  name,
}: {
  control: Control<FormValues>;
  name: Parameters<UseFormRegister<FormValues>>[0];
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground text-xs">Severity</span>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select
            items={DSR_ISSUE_SEVERITIES.map((s) => ({ value: s, label: dsrIssueSeverityLabel(s) }))}
            value={(field.value as string) || "LOW"}
            onValueChange={(v) => field.onChange(v ?? "LOW")}
          >
            <SelectTrigger size="sm" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DSR_ISSUE_SEVERITIES.map((s) => (
                <SelectItem key={s} value={s}>
                  {dsrIssueSeverityLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </div>
  );
}

function ResolvedField({
  control,
  name,
  index,
}: {
  control: Control<FormValues>;
  name: Parameters<UseFormRegister<FormValues>>[0];
  index: number;
}) {
  const id = `issue-resolved-${index}`;
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Label htmlFor={id} className="gap-1.5 text-xs font-normal">
          <Checkbox
            id={id}
            checked={Boolean(field.value)}
            onCheckedChange={(checked) => field.onChange(checked)}
          />
          Resolved
        </Label>
      )}
    />
  );
}

// ── Read-only view (SUBMITTED, or not the author) ─────────────────────────────
function DsrReadOnly({
  dsr,
  photos,
  timeZone,
  canReopen,
}: {
  dsr: DsrEditorData;
  photos: Paginated<AttachmentRow>;
  timeZone: string;
  canReopen: boolean;
}) {
  return (
    <div className="space-y-5">
      {dsr.status === "SUBMITTED" ? (
        <div className="text-muted-foreground bg-muted/30 flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-xs">
          <Lock className="size-4 shrink-0" />
          This report is submitted and locked. Only an admin can re-open it for changes.
        </div>
      ) : (
        <div className="text-muted-foreground bg-muted/30 flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-xs">
          <Lock className="size-4 shrink-0" />
          You can view this draft, but only its author can edit it.
        </div>
      )}

      <div className="space-y-4 rounded-lg border p-4">
        <ReadField label="Weather" value={dsr.weather} />
        <ReadField label="Work accomplished" value={dsr.workAccomplished} />
        <div className="grid gap-4 sm:grid-cols-2">
          <ReadField label="Next-day plan" value={dsr.nextDayPlan} />
          <ReadField label="Progress note" value={dsr.progressNote} />
        </div>
      </div>

      <Section icon={HardHat} title="Manpower" count={dsr.manpower.length}>
        {dsr.manpower.length === 0 ? (
          <EmptyRow label="No manpower logged." />
        ) : (
          <ul className="divide-border divide-y rounded-lg border">
            {dsr.manpower.map((m, i) => {
              const trade = TRADES.find((t) => t.code === m.tradeCode);
              return (
                <li key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span>{m.employeeName ?? trade?.label ?? "Crew"}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {m.headcount} {m.headcount === 1 ? "person" : "people"}
                    {m.hours != null ? ` · ${m.hours} hrs` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section icon={Truck} title="Equipment" count={dsr.equipment.length}>
        {dsr.equipment.length === 0 ? (
          <EmptyRow label="No equipment logged." />
        ) : (
          <ul className="divide-border divide-y rounded-lg border">
            {dsr.equipment.map((e, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 truncate">
                  {e.name}
                  {e.remarks ? <span className="text-muted-foreground"> — {e.remarks}</span> : null}
                </span>
                <span className="text-muted-foreground shrink-0 tabular-nums">
                  ×{e.quantity}
                  {e.hours != null ? ` · ${e.hours} hrs` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section icon={Package} title="Materials" count={dsr.materials.length}>
        {dsr.materials.length === 0 ? (
          <EmptyRow label="No materials logged." />
        ) : (
          <ul className="divide-border divide-y rounded-lg border">
            {dsr.materials.map((m, i) => {
              const unit = UNITS.find((u) => u.code === m.unitCode);
              return (
                <li key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate">{m.description ?? "Material"}</span>
                  <span className="text-muted-foreground shrink-0 tabular-nums">
                    {m.quantity}
                    {unit ? ` ${unit.symbol}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section icon={TriangleAlert} title="Site issues" count={dsr.issues.length}>
        {dsr.issues.length === 0 ? (
          <EmptyRow label="No issues logged." />
        ) : (
          <ul className="space-y-2">
            {dsr.issues.map((issue, i) => (
              <li key={i} className="space-y-1.5 rounded-lg border p-3 text-sm">
                <p className="whitespace-pre-wrap">{issue.description}</p>
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 font-medium",
                      issue.severity === "HIGH"
                        ? "border-destructive/40 bg-destructive/10 text-destructive"
                        : issue.severity === "MEDIUM"
                          ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                          : "border-border text-muted-foreground",
                    )}
                  >
                    {dsrIssueSeverityLabel(issue.severity)}
                  </span>
                  {issue.resolved ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="size-3.5" /> Resolved
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Open</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        icon={Camera}
        title="Site photos"
        count={photos.total}
        defaultOpen={photos.total > 0}
      >
        <DsrPhotoPanel dsrId={dsr.id} photos={photos} timeZone={timeZone} canEdit={false} />
      </Section>

      {canReopen ? <ReopenControl dsrId={dsr.id} /> : null}
    </div>
  );
}

function ReopenControl({ dsrId }: { dsrId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, start] = useProgressTransition();

  function confirm() {
    start(async () => {
      const result = await reopenDsrAction({ id: dsrId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Report re-opened for editing.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="flex justify-end border-t pt-4">
      <Button variant="outline" onClick={() => setOpen(true)}>
        <RotateCcw /> Re-open report
      </Button>
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!next && !isPending) setOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Re-open this report?</AlertDialogTitle>
            <AlertDialogDescription>
              It returns to draft so the author can correct it, and drops out of the submitted
              record until it&apos;s submitted again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirm} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="animate-spin" /> Re-opening…
                </>
              ) : (
                "Re-open"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

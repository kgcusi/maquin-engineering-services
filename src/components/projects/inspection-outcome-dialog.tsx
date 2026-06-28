"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ImagePlus, Loader2, Minus, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
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
import { formatBytes, isAllowedMime, MAX_UPLOAD_BYTES } from "@/lib/uploads";
import { cn } from "@/lib/utils";
import {
  getInspectionRecordingDefaultsAction,
  listActiveChecklistsAction,
  presignInspectionPhotoAction,
  recordInspectionOutcomeAction,
} from "@/modules/projects/inspections/actions";
import type { ChecklistTree } from "@/modules/projects/inspections/checklists/queries";
import type { InspectionRecordingDefaults } from "@/modules/projects/inspections/queries";

const NO_CHECKLIST = "";
const PHOTO_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

type ItemResult = "PASS" | "FAIL" | "NA";
type Overall = "PASSED" | "FAILED";

type Target = { id: string; title: string; refCode: string; status: string };

type ItemPhoto = { fileId: string; filename: string };
// One editable line on the outcome. Seeded from a preset (label + guidance fixed)
// or added ad-hoc (blank, editable label). `key` is a stable local id for React +
// per-row patches; it never leaves the client.
type ItemRow = {
  key: string;
  label: string;
  guidance: string | null;
  result: ItemResult | null;
  remarks: string;
  photos: ItemPhoto[];
};

function makeRow(init: Partial<ItemRow> = {}): ItemRow {
  return {
    key: crypto.randomUUID(),
    label: "",
    guidance: null,
    result: null,
    remarks: "",
    photos: [],
    ...init,
  };
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-destructive text-xs">
      {message}
    </p>
  );
}

export function InspectionOutcomeDialog({
  inspection,
  onOpenChange,
}: {
  inspection: Target | null;
  onOpenChange: (open: boolean) => void;
}) {
  const reinspect = inspection ? inspection.status !== "REQUESTED" : false;
  return (
    <Dialog open={inspection !== null} onOpenChange={onOpenChange} disablePointerDismissal>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="p-4 pb-3">
          <DialogTitle>{reinspect ? "Re-inspect" : "Record inspection outcome"}</DialogTitle>
          <DialogDescription>
            {inspection ? (
              <>
                <span className="font-medium">{inspection.title}</span> ·{" "}
                <span className="font-mono text-xs">{inspection.refCode}</span>
                {reinspect ? " · a new attempt will be appended" : null}
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        {inspection ? (
          <OutcomeForm
            key={inspection.id}
            inspection={inspection}
            reinspect={reinspect}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

type LoadState =
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "ready"; checklists: ChecklistTree[]; defaults: InspectionRecordingDefaults };

function OutcomeForm({
  inspection,
  reinspect,
  onDone,
}: {
  inspection: Target;
  reinspect: boolean;
  onDone: () => void;
}) {
  const router = useRouter();
  const [isPending, start] = useProgressTransition();

  const [load, setLoad] = useState<LoadState>({ phase: "loading" });
  const [checklistId, setChecklistId] = useState<string>(NO_CHECKLIST);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [itemsError, setItemsError] = useState<string | undefined>();
  const [outcome, setOutcome] = useState<Overall | null>(null);
  const [remarks, setRemarks] = useState("");
  const [remarksError, setRemarksError] = useState<string | undefined>();
  const [uploadingCount, setUploadingCount] = useState(0);

  // Kicks off the load; only setStates from the async callbacks (never synchronously
  // in the effect body) so it doesn't trip react-hooks/set-state-in-effect. The
  // initial `load` state is already "loading", so the effect needs no sync reset.
  const fetchData = useCallback(() => {
    let active = true;
    Promise.all([
      listActiveChecklistsAction({}),
      getInspectionRecordingDefaultsAction({ inspectionId: inspection.id }),
    ])
      .then(([checklistsRes, defaultsRes]) => {
        if (!active) return;
        if (!checklistsRes.ok || !defaultsRes.ok) {
          const err = !checklistsRes.ok
            ? checklistsRes.error
            : (defaultsRes as { error: string }).error;
          toast.error(err);
          setLoad({ phase: "error" });
          return;
        }
        const checklists = checklistsRes.data;
        const defaults = defaultsRes.data;
        const preset =
          defaults.checklistId && checklists.some((c) => c.id === defaults.checklistId)
            ? defaults.checklistId
            : NO_CHECKLIST;
        setChecklistId(preset);
        setItems(
          preset === NO_CHECKLIST
            ? buildFreeformRows(defaults)
            : buildItemRows(checklists, preset, defaults),
        );
        setLoad({ phase: "ready", checklists, defaults });
      })
      .catch(() => {
        if (active) {
          toast.error("Couldn't load the checklist. Please try again.");
          setLoad({ phase: "error" });
        }
      });
    return () => {
      active = false;
    };
  }, [inspection.id]);

  useEffect(() => fetchData(), [fetchData]);

  // Retry is an event handler (not an effect), so resetting to loading here is fine.
  function retry() {
    setLoad({ phase: "loading" });
    fetchData();
  }

  const hasPreset = checklistId !== NO_CHECKLIST;

  function onChecklistChange(next: string | null) {
    if (load.phase !== "ready") return;
    const value = next ?? NO_CHECKLIST;
    setChecklistId(value);
    setItemsError(undefined);
    // Selecting a preset loads its standard items (carrying prior results by label);
    // clearing to free-form keeps whatever the inspector has already entered.
    if (value !== NO_CHECKLIST) {
      setItems(buildItemRows(load.checklists, value, load.defaults));
    }
  }

  function patchRow(key: string, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setItemsError(undefined);
    setItems((prev) => [...prev, makeRow()]);
  }
  function removeRow(key: string) {
    setItemsError(undefined);
    setItems((prev) => prev.filter((r) => r.key !== key));
  }

  const uploading = uploadingCount > 0;

  function onSubmit() {
    if (!outcome) return;
    if (outcome === "FAILED" && !remarks.trim()) {
      setRemarksError("Add remarks explaining the failure");
      return;
    }
    setRemarksError(undefined);

    // Blank-label rows with data are a mistake (the server rejects empty labels);
    // fully-blank rows are just dropped.
    const trimmed = items.map((r) => ({ ...r, label: r.label.trim() }));
    const hasData = (r: ItemRow) =>
      r.result !== null || r.remarks.trim() !== "" || r.photos.length > 0;
    if (trimmed.some((r) => r.label === "" && hasData(r))) {
      setItemsError("Name every checklist item, or remove the empty ones.");
      return;
    }
    setItemsError(undefined);

    const payloadItems = trimmed
      .filter((r) => r.label !== "")
      .map((r) => ({
        label: r.label,
        result: (r.result ?? "NA") as ItemResult,
        remarks: r.remarks.trim() || undefined,
        fileIds: r.photos.map((p) => p.fileId),
      }));

    start(async () => {
      const result = await recordInspectionOutcomeAction({
        id: inspection.id,
        outcome,
        remarks: remarks.trim() || undefined,
        checklistId: checklistId || undefined,
        items: payloadItems,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        reinspect
          ? "Re-inspection recorded."
          : outcome === "PASSED"
            ? "Inspection passed."
            : "Inspection failed.",
      );
      router.refresh();
      onDone();
    });
  }

  const failed = outcome === "FAILED";
  const controlsDisabled = isPending || uploading;
  const submitDisabled =
    controlsDisabled || !outcome || (failed && !remarks.trim()) || load.phase !== "ready";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {load.phase === "loading" ? (
        <div className="text-muted-foreground flex items-center justify-center gap-2 px-4 py-16 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Loading checklist…
        </div>
      ) : load.phase === "error" ? (
        <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
          <p className="text-sm font-medium">Couldn&apos;t load the checklist.</p>
          <p className="text-muted-foreground max-w-sm text-sm">
            The preset checklists and prior results didn&apos;t load. Check your connection and try
            again.
          </p>
          <div className="mt-1 flex items-center gap-2">
            <Button variant="outline" onClick={onDone}>
              Cancel
            </Button>
            <Button onClick={retry}>
              <RefreshCw className="size-4" /> Retry
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-1">
            <div className="space-y-2">
              <Label htmlFor="checklist-picker">Checklist</Label>
              <Combobox
                aria-label="Preset checklist"
                items={checklistOptions(load.checklists)}
                value={checklistId}
                onValueChange={onChecklistChange}
                placeholder="No checklist (free-form)"
                searchPlaceholder="Search checklists…"
                emptyText="No active checklists."
                disabled={controlsDisabled}
              />
              <p className="text-muted-foreground text-xs">
                {hasPreset
                  ? "Loaded a preset — edit, add or remove lines freely. The overall result below is your call; items are evidence, not an auto-gate."
                  : "Add checklist items to record line-by-line, or just set the overall result below."}
              </p>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <Label>Checklist items</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={addRow}
                  disabled={controlsDisabled}
                >
                  <Plus className="size-3.5" /> Add item
                </Button>
              </div>
              {items.length === 0 ? (
                <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-6 text-center text-xs">
                  No checklist items. Add items to record line-by-line, or just set the overall
                  result below.
                </p>
              ) : (
                <ol className="space-y-2.5">
                  {items.map((row, index) => (
                    <ChecklistItemRow
                      key={row.key}
                      index={index}
                      row={row}
                      inspectionId={inspection.id}
                      disabled={isPending}
                      onLabelChange={(value) => {
                        patchRow(row.key, { label: value });
                        if (itemsError) setItemsError(undefined);
                      }}
                      onResult={(result) => patchRow(row.key, { result })}
                      onRemarks={(value) => patchRow(row.key, { remarks: value })}
                      onPhotosChange={(photos) => patchRow(row.key, { photos })}
                      onRemove={() => removeRow(row.key)}
                      onUploadingChange={(delta) =>
                        setUploadingCount((c) => Math.max(0, c + delta))
                      }
                    />
                  ))}
                </ol>
              )}
              <FieldError message={itemsError} />
            </div>

            <div className="border-border/70 space-y-3 border-t py-4">
              <div className="space-y-2">
                <Label>Overall result</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    aria-pressed={outcome === "PASSED"}
                    disabled={controlsDisabled}
                    onClick={() => setOutcome("PASSED")}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium transition-colors disabled:opacity-50",
                      outcome === "PASSED"
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : "border-border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <Check className="size-4" /> Pass
                  </button>
                  <button
                    type="button"
                    aria-pressed={outcome === "FAILED"}
                    disabled={controlsDisabled}
                    onClick={() => setOutcome("FAILED")}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium transition-colors disabled:opacity-50",
                      outcome === "FAILED"
                        ? "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400"
                        : "border-border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <X className="size-4" /> Fail
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="inspection-remarks" required={failed}>
                  {failed ? "What failed?" : "Remarks"}
                </Label>
                <Textarea
                  id="inspection-remarks"
                  rows={3}
                  placeholder={
                    failed
                      ? "Explain the defect so it can be reworked."
                      : "Optional notes on the inspection."
                  }
                  disabled={controlsDisabled}
                  value={remarks}
                  onChange={(e) => {
                    setRemarks(e.target.value);
                    if (remarksError) setRemarksError(undefined);
                  }}
                  aria-invalid={remarksError ? true : undefined}
                />
                <FieldError message={remarksError} />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-0 items-center rounded-b-none border-t pr-8 pb-8">
            {uploading ? (
              <span className="text-muted-foreground mr-auto flex items-center gap-1.5 text-xs">
                <Loader2 className="size-3.5 animate-spin" /> Uploading photo…
              </span>
            ) : null}
            <Button type="button" variant="outline" onClick={onDone} disabled={isPending}>
              Cancel
            </Button>
            <Button type="button" onClick={onSubmit} disabled={submitDisabled}>
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Saving…
                </>
              ) : reinspect ? (
                "Record re-inspection"
              ) : (
                "Save outcome"
              )}
            </Button>
          </DialogFooter>
        </>
      )}
    </div>
  );
}

const ITEM_RESULTS: { value: ItemResult; label: string; active: string; icon: typeof Check }[] = [
  {
    value: "PASS",
    label: "Pass",
    active: "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    icon: Check,
  },
  {
    value: "FAIL",
    label: "Fail",
    active: "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400",
    icon: X,
  },
  {
    value: "NA",
    label: "N/A",
    active: "border-border bg-muted text-foreground",
    icon: Minus,
  },
];

function ChecklistItemRow({
  index,
  row,
  inspectionId,
  disabled,
  onLabelChange,
  onResult,
  onRemarks,
  onPhotosChange,
  onRemove,
  onUploadingChange,
}: {
  index: number;
  row: ItemRow;
  inspectionId: string;
  disabled: boolean;
  onLabelChange: (value: string) => void;
  onResult: (result: ItemResult) => void;
  onRemarks: (value: string) => void;
  onPhotosChange: (photos: ItemPhoto[]) => void;
  onRemove: () => void;
  onUploadingChange: (delta: 1 | -1) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  function pick(file: File | null) {
    if (!file) return;
    if (!isAllowedMime(file.type) || !file.type.startsWith("image/")) {
      toast.error("Pick an image (PNG, JPEG, WebP or GIF).");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(`That photo is too large (max ${formatBytes(MAX_UPLOAD_BYTES)}).`);
      return;
    }
    setBusy(true);
    onUploadingChange(1);
    void (async () => {
      try {
        const presigned = await presignInspectionPhotoAction({
          inspectionId,
          filename: file.name,
          mime: file.type,
          size: file.size,
        });
        if (!presigned.ok) {
          toast.error(presigned.error);
          return;
        }
        const res = await fetch(presigned.data.url, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!res.ok) throw new Error(`R2 PUT ${res.status}`);
        onPhotosChange([...row.photos, { fileId: presigned.data.fileId, filename: file.name }]);
      } catch (err) {
        console.error("[inspection-photo] upload failed", err);
        toast.error("Photo upload failed. Please try again.");
      } finally {
        setBusy(false);
        onUploadingChange(-1);
        if (inputRef.current) inputRef.current.value = "";
      }
    })();
  }

  function removePhoto(fileId: string) {
    onPhotosChange(row.photos.filter((p) => p.fileId !== fileId));
  }

  const rowDisabled = disabled || busy;

  return (
    <li className="bg-card rounded-xl border p-3">
      <div className="flex items-start gap-2.5">
        <span className="text-muted-foreground bg-muted mt-1.5 flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold tabular-nums">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <Input
                value={row.label}
                onChange={(e) => onLabelChange(e.target.value)}
                disabled={rowDisabled}
                maxLength={300}
                placeholder="Checklist item"
                aria-label={`Item ${index + 1} label`}
                className="h-8 font-medium"
              />
              {row.guidance ? (
                <p className="text-muted-foreground px-1 text-xs">{row.guidance}</p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onRemove}
              disabled={rowDisabled}
              aria-label={`Remove item ${index + 1}`}
              className="text-muted-foreground hover:text-destructive shrink-0"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>

          <div className="inline-grid grid-cols-3 gap-1.5">
            {ITEM_RESULTS.map(({ value, label: rLabel, active, icon: Icon }) => {
              const selected = row.result === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  disabled={rowDisabled}
                  onClick={() => onResult(value)}
                  className={cn(
                    "flex items-center justify-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
                    selected
                      ? active
                      : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5" /> {rLabel}
                </button>
              );
            })}
          </div>

          <Input
            value={row.remarks}
            onChange={(e) => onRemarks(e.target.value)}
            disabled={rowDisabled}
            maxLength={2000}
            placeholder="Note (optional)"
            aria-label={`Remarks for item ${index + 1}`}
            className="h-7"
          />

          <div className="flex flex-wrap items-center gap-1.5">
            {row.photos.map((photo) => (
              <span
                key={photo.fileId}
                className="bg-muted/60 inline-flex max-w-44 items-center gap-1 rounded-md border py-0.5 pr-1 pl-2 text-xs"
              >
                <span className="truncate">{photo.filename}</span>
                <button
                  type="button"
                  onClick={() => removePhoto(photo.fileId)}
                  disabled={rowDisabled}
                  aria-label={`Remove ${photo.filename}`}
                  className="text-muted-foreground hover:text-destructive shrink-0 disabled:opacity-50"
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
            <input
              ref={inputRef}
              type="file"
              accept={PHOTO_ACCEPT}
              className="hidden"
              disabled={rowDisabled}
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="text-muted-foreground"
              disabled={rowDisabled}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? (
                <>
                  <Loader2 className="size-3 animate-spin" /> Uploading…
                </>
              ) : (
                <>
                  <ImagePlus className="size-3" /> Add photo
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}

function checklistOptions(checklists: ChecklistTree[]) {
  return [
    { value: NO_CHECKLIST, label: "No checklist (free-form)" },
    ...checklists.map((c) => ({
      value: c.id,
      label: c.category ? `${c.name} — ${c.category}` : c.name,
    })),
  ];
}

// Seed editable rows from the selected preset. On re-inspect, carry the last
// attempt's result + remarks forward by matching on label; new items start blank.
// Photos are never carried forward — the inspector re-shoots what they re-check.
function buildItemRows(
  checklists: ChecklistTree[],
  checklistId: string,
  defaults: InspectionRecordingDefaults,
): ItemRow[] {
  const checklist = checklists.find((c) => c.id === checklistId);
  if (!checklist) return [];
  const priorByLabel = new Map(defaults.items.map((it) => [it.label, it]));
  return checklist.items.map((item) => {
    const prior = priorByLabel.get(item.label);
    return makeRow({
      label: item.label,
      guidance: item.guidance,
      result: isItemResult(prior?.result) ? prior!.result : null,
      remarks: prior?.remarks ?? "",
    });
  });
}

// Free-form re-inspect: carry the prior attempt's ad-hoc items forward (label +
// result + remarks) so a re-check starts from last time's lines, not a blank slate.
function buildFreeformRows(defaults: InspectionRecordingDefaults): ItemRow[] {
  return defaults.items.map((it) =>
    makeRow({
      label: it.label,
      result: isItemResult(it.result) ? it.result : null,
      remarks: it.remarks ?? "",
    }),
  );
}

function isItemResult(value: string | null | undefined): value is ItemResult {
  return value === "PASS" || value === "FAIL" || value === "NA";
}

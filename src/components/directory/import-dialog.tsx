"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileDown,
  FileSpreadsheet,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useProgressTransition } from "@/hooks/use-progress-transition";
import {
  buildErrorReport,
  buildTemplate,
  IMPORT_ROW_LIMIT,
  mapAndValidate,
  parseWorkbook,
  type ImportDescriptor,
  type ImportPreview,
  type RowStatus,
} from "@/modules/shared/import";

type CommitResult = { ok: true; data: { count: number } } | { ok: false; error: string };

type ImportDialogProps<T> = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  descriptor: ImportDescriptor<T>;
  /** Existing dedupe-key values (e.g. current client names) for the soft duplicate warning. */
  existingKeys: string[];
  /** The guarded bulk Server Action — re-validates and inserts the rows. */
  commitAction: (rows: T[]) => Promise<CommitResult>;
};

type Step = "upload" | "preview" | "done";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function StatusBadge({ status }: { status: RowStatus }) {
  if (status === "error") {
    return (
      <Badge variant="destructive">
        <AlertCircle /> Error
      </Badge>
    );
  }
  if (status === "duplicate") {
    return (
      <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">
        <AlertTriangle /> Duplicate
      </Badge>
    );
  }
  return (
    <Badge variant="default">
      <CheckCircle2 /> Ready
    </Badge>
  );
}

export function ImportDialog<T>({
  open,
  onOpenChange,
  descriptor,
  existingKeys,
  commitAction,
}: ImportDialogProps<T>) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useProgressTransition();

  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview<T> | null>(null);
  const [included, setIncluded] = useState<Set<number>>(new Set());
  const [importedCount, setImportedCount] = useState(0);

  function reset() {
    setStep("upload");
    setFileName("");
    setParsing(false);
    setParseError(null);
    setPreview(null);
    setIncluded(new Set());
    setImportedCount(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function handleFile(file: File) {
    setFileName(file.name);
    setParsing(true);
    setParseError(null);
    try {
      const sheet = await parseWorkbook(file);
      const result = mapAndValidate(sheet, descriptor, existingKeys);
      setPreview(result);
      setIncluded(new Set(result.rows.filter((r) => r.status === "ok").map((r) => r.index)));
      setStep("preview");
    } catch (err) {
      console.error("[import] parse failed", err);
      setParseError(
        "We couldn't read that file. Make sure it's a valid CSV or Excel (.xlsx) file.",
      );
    } finally {
      setParsing(false);
    }
  }

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void handleFile(file);
  }

  function onDrop(event: React.DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  async function handleTemplate() {
    const blob = await buildTemplate(descriptor);
    downloadBlob(blob, `${descriptor.noun}-import-template.xlsx`);
  }

  const toggleableRows = preview?.rows.filter((r) => r.status !== "error") ?? [];
  const allIncluded =
    toggleableRows.length > 0 && toggleableRows.every((r) => included.has(r.index));

  function toggleRow(index: number) {
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function toggleAll() {
    setIncluded(() => (allIncluded ? new Set() : new Set(toggleableRows.map((r) => r.index))));
  }

  const overLimit = (preview?.counts.total ?? 0) > IMPORT_ROW_LIMIT;
  const canImport =
    !!preview &&
    preview.missingRequired.length === 0 &&
    !overLimit &&
    included.size > 0 &&
    !isPending;

  function handleImport() {
    if (!preview) return;
    const rows = preview.rows
      .filter((r) => r.parsed && included.has(r.index))
      .map((r) => r.parsed as T);
    if (!rows.length) return;
    startTransition(async () => {
      const result = await commitAction(rows);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setImportedCount(result.data.count);
      setStep("done");
      toast.success(`Imported ${result.data.count} ${descriptor.noun}.`);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} disablePointerDismissal>
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden sm:max-w-3xl">
        <DialogHeader className="pr-8">
          <DialogTitle>Import {descriptor.noun}</DialogTitle>
          <DialogDescription>
            {step === "preview"
              ? "Review what will be added before importing."
              : step === "done"
                ? "Import complete."
                : `Add many ${descriptor.noun} at once from a spreadsheet.`}
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-4 flex-1 overflow-y-auto px-4 py-4">
          {step === "upload" && (
            <UploadStep
              descriptor={descriptor}
              parsing={parsing}
              parseError={parseError}
              fileInputRef={fileInputRef}
              onPick={() => fileInputRef.current?.click()}
              onFileChange={onFileChange}
              onDrop={onDrop}
              onTemplate={handleTemplate}
            />
          )}

          {step === "preview" && preview && (
            <PreviewStep
              descriptor={descriptor}
              preview={preview}
              fileName={fileName}
              included={included}
              allIncluded={allIncluded}
              overLimit={overLimit}
              onToggleRow={toggleRow}
              onToggleAll={toggleAll}
              onErrorReport={() =>
                downloadBlob(
                  buildErrorReport(descriptor, preview),
                  `${descriptor.noun}-import-errors.csv`,
                )
              }
            />
          )}

          {step === "done" && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <span className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-full">
                <CheckCircle2 className="size-6" />
              </span>
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  Imported {importedCount} {descriptor.noun}
                </p>
                <p className="text-muted-foreground text-sm">They now appear in the directory.</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {step === "upload" && (
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
          )}

          {step === "preview" && (
            <>
              <Button type="button" variant="outline" onClick={reset} disabled={isPending}>
                <ArrowLeft /> Choose another file
              </Button>
              <Button type="button" onClick={handleImport} disabled={!canImport}>
                {isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Importing…
                  </>
                ) : (
                  `Import ${included.size} ${included.size === 1 ? descriptor.entity.toLowerCase() : descriptor.noun}`
                )}
              </Button>
            </>
          )}

          {step === "done" && (
            <>
              <Button type="button" variant="outline" onClick={reset}>
                Import more
              </Button>
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Done
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UploadStep<T>({
  descriptor,
  parsing,
  parseError,
  fileInputRef,
  onPick,
  onFileChange,
  onDrop,
  onTemplate,
}: {
  descriptor: ImportDescriptor<T>;
  parsing: boolean;
  parseError: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onPick: () => void;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (event: React.DragEvent) => void;
  onTemplate: () => void;
}) {
  return (
    <div className="space-y-5">
      <ol className="text-muted-foreground list-inside list-decimal space-y-1 text-sm">
        <li>Download the template and fill in one {descriptor.entity.toLowerCase()} per row.</li>
        <li>Save it as CSV or Excel (.xlsx) — up to {IMPORT_ROW_LIMIT} rows.</li>
        <li>Upload it here to preview and confirm before anything is saved.</li>
      </ol>

      <Button type="button" variant="outline" size="sm" onClick={onTemplate}>
        <Download /> Download Excel template
      </Button>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead>Column</TableHead>
              <TableHead className="w-20 text-center">Required</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Example</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {descriptor.columns.map((col) => (
              <TableRow key={col.key}>
                <TableCell className="font-medium whitespace-nowrap">{col.header}</TableCell>
                <TableCell className="text-center">
                  {col.required ? (
                    <Badge variant="default">Required</Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">Optional</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{col.description}</TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {col.example}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <button
        type="button"
        onClick={onPick}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className="hover:border-primary/50 hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-ring/50 flex w-full flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center transition-colors focus-visible:ring-3 focus-visible:outline-none"
      >
        <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full">
          {parsing ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <FileSpreadsheet className="size-5" />
          )}
        </span>
        <span className="text-sm font-medium">
          {parsing ? "Reading file…" : "Choose a file or drag it here"}
        </span>
        <span className="text-muted-foreground text-xs">CSV or Excel (.xlsx)</span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          onChange={onFileChange}
        />
      </button>

      {parseError && (
        <p role="alert" className="text-destructive flex items-center gap-2 text-sm">
          <AlertCircle className="size-4" /> {parseError}
        </p>
      )}
    </div>
  );
}

function PreviewStep<T>({
  descriptor,
  preview,
  fileName,
  included,
  allIncluded,
  overLimit,
  onToggleRow,
  onToggleAll,
  onErrorReport,
}: {
  descriptor: ImportDescriptor<T>;
  preview: ImportPreview<T>;
  fileName: string;
  included: Set<number>;
  allIncluded: boolean;
  overLimit: boolean;
  onToggleRow: (index: number) => void;
  onToggleAll: () => void;
  onErrorReport: () => void;
}) {
  const { counts } = preview;
  const someIncluded = preview.rows.some((r) => r.status !== "error" && included.has(r.index));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <span className="text-muted-foreground inline-flex items-center gap-1.5">
          <FileSpreadsheet className="size-4" /> {fileName}
        </span>
        <span className="text-muted-foreground">·</span>
        <span className="text-primary font-medium">{counts.ready} ready</span>
        {counts.duplicates > 0 && (
          <span className="text-amber-600 dark:text-amber-400">
            {counts.duplicates} possible duplicate{counts.duplicates === 1 ? "" : "s"}
          </span>
        )}
        {counts.errors > 0 && (
          <span className="text-destructive">
            {counts.errors} with error{counts.errors === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {preview.missingRequired.length > 0 && (
        <p
          role="alert"
          className="text-destructive bg-destructive/10 flex items-start gap-2 rounded-md p-3 text-sm"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>
            Missing required column{preview.missingRequired.length === 1 ? "" : "s"}:{" "}
            <strong>{preview.missingRequired.join(", ")}</strong>. Add{" "}
            {preview.missingRequired.length === 1 ? "it" : "them"} to your file and re-upload.
          </span>
        </p>
      )}

      {overLimit && (
        <p
          role="alert"
          className="text-destructive bg-destructive/10 flex items-start gap-2 rounded-md p-3 text-sm"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>
            This file has {counts.total} rows — the limit is {IMPORT_ROW_LIMIT}. Split it into
            smaller files.
          </span>
        </p>
      )}

      {counts.errors > 0 && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-muted-foreground text-xs">
            Rows with errors can’t be imported. Fix them in your file, or download the report.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={onErrorReport}>
            <FileDown /> Error report
          </Button>
        </div>
      )}

      <div className="max-h-[48vh] overflow-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/40 sticky top-0 z-10">
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  aria-label="Include all importable rows"
                  className="cursor-pointer align-middle"
                  checked={allIncluded}
                  indeterminate={someIncluded && !allIncluded}
                  onCheckedChange={() => onToggleAll()}
                />
              </TableHead>
              <TableHead className="w-12 text-right tabular-nums">#</TableHead>
              <TableHead className="w-40">Status</TableHead>
              {descriptor.columns.map((col) => (
                <TableHead key={col.key} className="whitespace-nowrap">
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {preview.rows.map((row) => {
              const isError = row.status === "error";
              return (
                <TableRow key={row.index} className={isError ? "bg-destructive/5" : undefined}>
                  <TableCell>
                    <Checkbox
                      aria-label={`Include row ${row.index}`}
                      className="cursor-pointer align-middle"
                      checked={included.has(row.index)}
                      disabled={isError}
                      onCheckedChange={() => onToggleRow(row.index)}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right tabular-nums">
                    {row.index}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <StatusBadge status={row.status} />
                      {isError &&
                        row.errors.map((e, i) => (
                          <p key={i} className="text-destructive text-xs">
                            {e.message}
                          </p>
                        ))}
                    </div>
                  </TableCell>
                  {descriptor.columns.map((col) => (
                    <TableCell key={col.key} className="whitespace-nowrap">
                      {row.values[col.key] ? (
                        row.values[col.key]
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

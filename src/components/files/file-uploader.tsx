"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProgressTransition } from "@/hooks/use-progress-transition";
import { formatBytes, isAllowedMime, MAX_UPLOAD_BYTES, UPLOAD_ACCEPT } from "@/lib/uploads";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

// Consumer-agnostic uploader: the parent binds the entity (e.g. clientId) into the
// two server actions. Flow: presign → direct browser PUT to R2 → confirm. Controls
// disable while in flight (no double-submit). When `kinds` is provided, a required
// document-type picker is shown and its value is passed to confirm (employees use
// this; clients don't).
type Props = {
  onRequestUrl: (meta: {
    filename: string;
    mime: string;
    size: number;
  }) => Promise<Result<{ fileId: string; url: string }>>;
  onConfirm: (fileId: string, kind?: string) => Promise<Result<unknown>>;
  kinds?: readonly string[];
};

export function FileUploader({ onRequestUrl, onConfirm, kinds }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState("");
  const [isPending, start] = useProgressTransition();

  const needsKind = Boolean(kinds && kinds.length > 0);

  function pick(next: File | null) {
    if (next && !isAllowedMime(next.type)) {
      toast.error("That file type isn't allowed.");
      return;
    }
    if (next && next.size > MAX_UPLOAD_BYTES) {
      toast.error(`File is too large (max ${formatBytes(MAX_UPLOAD_BYTES)}).`);
      return;
    }
    setFile(next);
  }

  function reset() {
    setFile(null);
    setKind("");
    if (inputRef.current) inputRef.current.value = "";
  }

  function upload() {
    if (!file || (needsKind && !kind)) return;
    const current = file;
    const currentKind = kind;
    start(async () => {
      const presigned = await onRequestUrl({
        filename: current.name,
        mime: current.type,
        size: current.size,
      });
      if (!presigned.ok) {
        toast.error(presigned.error);
        return;
      }
      try {
        const res = await fetch(presigned.data.url, {
          method: "PUT",
          headers: { "Content-Type": current.type },
          body: current,
        });
        if (!res.ok) throw new Error(`R2 PUT ${res.status}`);
      } catch (err) {
        console.error("[upload] PUT failed", err);
        toast.error("Upload failed. Please try again.");
        return;
      }
      const confirmed = await onConfirm(presigned.data.fileId, currentKind || undefined);
      if (!confirmed.ok) {
        toast.error(confirmed.error);
        return;
      }
      toast.success("Document uploaded.");
      reset();
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed p-4">
      {needsKind ? (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-12 shrink-0 text-xs">Type</span>
          <Select value={kind} onValueChange={(v) => setKind(v ?? "")} disabled={isPending}>
            <SelectTrigger className="h-8 w-56">
              <SelectValue placeholder="Select a document type" />
            </SelectTrigger>
            <SelectContent>
              {kinds!.map((k) => (
                <SelectItem key={k} value={k}>
                  {k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          ref={inputRef}
          type="file"
          accept={UPLOAD_ACCEPT}
          className="hidden"
          disabled={isPending}
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
        />
        <div className="min-w-0">
          {file ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="truncate font-medium">{file.name}</span>
              <span className="text-muted-foreground shrink-0">{formatBytes(file.size)}</span>
              {!isPending ? (
                <button
                  type="button"
                  onClick={reset}
                  aria-label="Clear selected file"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              PDF, image, or Office file — up to {formatBytes(MAX_UPLOAD_BYTES)}.
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={isPending}
          >
            Choose file
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={upload}
            disabled={!file || isPending || (needsKind && !kind)}
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Uploading…
              </>
            ) : (
              <>
                <Upload className="size-4" /> Upload
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { TablePagination } from "@/components/directory/table-pagination";
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
import { useProgressTransition } from "@/hooks/use-progress-transition";
import { formatDateTime } from "@/lib/datetime";
import { formatBytes } from "@/lib/uploads";
import type { AttachmentRow } from "@/modules/files/service";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

type Props = {
  documents: AttachmentRow[];
  page: number;
  total: number;
  pageSize: number;
  /** Query-string key this panel pages on (e.g. `docsPage`). */
  paramKey: string;
  timeZone: string;
  onDownload: (attachmentId: string) => Promise<Result<{ url: string; filename: string }>>;
  onDelete: (attachmentId: string) => Promise<Result<unknown>>;
};

export function AttachmentList({
  documents,
  page,
  total,
  pageSize,
  paramKey,
  timeZone,
  onDownload,
  onDelete,
}: Props) {
  const router = useRouter();
  const [isPending, start] = useProgressTransition();
  const [deleteTarget, setDeleteTarget] = useState<AttachmentRow | null>(null);

  function download(attachmentId: string) {
    start(async () => {
      const res = await onDownload(attachmentId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      window.open(res.data.url, "_blank", "noopener,noreferrer");
    });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.attachmentId;
    start(async () => {
      const res = await onDelete(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Document removed.");
      setDeleteTarget(null);
      router.refresh();
    });
  }

  if (total === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed py-10 text-center text-sm">
        No documents yet. Upload contracts, permits, or other files.
      </p>
    );
  }

  return (
    <>
      {documents.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed py-10 text-center text-sm">
          No documents on this page.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {documents.map((doc) => {
            const title = doc.label ?? doc.filename;
            return (
              <li key={doc.attachmentId} className="flex items-center gap-3 p-3">
                <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-md">
                  <FileText className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{title}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {doc.label ? `${doc.filename} · ` : ""}
                    {formatBytes(doc.size)} · {doc.uploadedByName ?? "—"} ·{" "}
                    {formatDateTime(doc.createdAt, timeZone, "date")}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Download ${title}`}
                  disabled={isPending}
                  onClick={() => download(doc.attachmentId)}
                >
                  <Download />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${title}`}
                  disabled={isPending}
                  onClick={() => setDeleteTarget(doc)}
                >
                  <Trash2 className="text-destructive" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <TablePagination compact page={page} total={total} pageSize={pageSize} paramKey={paramKey} />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove document?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium">{deleteTarget?.label ?? deleteTarget?.filename}</span>{" "}
              will be permanently deleted from storage. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Removing…
                </>
              ) : (
                "Remove"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

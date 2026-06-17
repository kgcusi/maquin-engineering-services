"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useProgressTransition } from "@/hooks/use-progress-transition";
import { formatDateTime } from "@/lib/datetime";
import type { NoteRow } from "@/modules/notes/service";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

type Props = {
  notes: NoteRow[];
  timeZone: string;
  onAdd: (body: string) => Promise<Result<unknown>>;
  onDelete: (noteId: string) => Promise<Result<unknown>>;
};

export function NotesPanel({ notes, timeZone, onAdd, onDelete }: Props) {
  const router = useRouter();
  const [isPending, start] = useProgressTransition();
  const [body, setBody] = useState("");

  function add() {
    const text = body.trim();
    if (!text) return;
    start(async () => {
      const res = await onAdd(text);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setBody("");
      toast.success("Note added.");
      router.refresh();
    });
  }

  function remove(noteId: string) {
    start(async () => {
      const res = await onDelete(noteId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Add a note about this client…"
          disabled={isPending}
          aria-label="New note"
        />
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={add}
            disabled={isPending || body.trim().length === 0}
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Send className="size-4" /> Add note
              </>
            )}
          </Button>
        </div>
      </div>

      {notes.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed py-10 text-center text-sm">
          No notes yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => (
            <li key={note.id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm whitespace-pre-wrap">{note.body}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete note"
                  disabled={isPending}
                  onClick={() => remove(note.id)}
                >
                  <Trash2 className="text-destructive" />
                </Button>
              </div>
              <p className="text-muted-foreground mt-2 text-xs">
                {note.authorName ?? "—"} · {formatDateTime(note.createdAt, timeZone, "datetime")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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
import { useProgressTransition } from "@/hooks/use-progress-transition";

// Generic delete confirmation reused by every directory entity table. The delete
// is a soft delete server-side (the row is kept for referential integrity), but
// it reads as a plain "Delete" to the user — the record leaves the directory.
type ActionFn = (input: {
  id: string;
}) => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  id: string | null;
  name: string | null;
  noun: string;
  deleteAction: ActionFn;
};

export function DeleteConfirm({ open, onOpenChange, id, name, noun, deleteAction }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useProgressTransition();

  function onConfirm() {
    if (!id) return;
    startTransition(async () => {
      const result = await deleteAction({ id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Deleted ${noun}.`);
      router.refresh();
      onOpenChange(false);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {noun}?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-medium">{name}</span> will be removed from the directory. Any
            records that already reference it stay intact.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Deleting…
              </>
            ) : (
              "Delete"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

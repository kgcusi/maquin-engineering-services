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

// Generic activate/deactivate confirmation reused by every directory entity table.
// Deactivate is the destructive-leaning path (it retires the record from selection
// elsewhere); activate is the plain restore. Both server actions are soft toggles —
// the record always stays in the directory.
type ActionFn = (input: {
  id: string;
}) => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  id: string | null;
  name: string | null;
  noun: string;
  /** The record's CURRENT state — true means the dialog will deactivate it. */
  isActive: boolean;
  activateAction: ActionFn;
  deactivateAction: ActionFn;
};

export function StatusConfirm({
  open,
  onOpenChange,
  id,
  name,
  noun,
  isActive,
  activateAction,
  deactivateAction,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useProgressTransition();
  const deactivating = isActive;

  function onConfirm() {
    if (!id) return;
    startTransition(async () => {
      const result = await (deactivating ? deactivateAction : activateAction)({ id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(deactivating ? `Deactivated ${noun}.` : `Activated ${noun}.`);
      router.refresh();
      onOpenChange(false);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {deactivating ? `Deactivate ${noun}?` : `Activate ${noun}?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {deactivating ? (
              <>
                <span className="font-medium">{name}</span> stays in the directory but will be
                excluded from selection in other modules until reactivated.
              </>
            ) : (
              <>
                <span className="font-medium">{name}</span> will be selectable again across the app.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={deactivating ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {deactivating ? "Deactivating…" : "Activating…"}
              </>
            ) : deactivating ? (
              "Deactivate"
            ) : (
              "Activate"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

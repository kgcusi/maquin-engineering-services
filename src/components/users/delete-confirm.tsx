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
import { deleteUserAction } from "@/modules/users/actions";
import type { UserRow } from "@/modules/users/queries";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserRow | null;
};

export function DeleteConfirm({ open, onOpenChange, user }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useProgressTransition();

  function onConfirm() {
    if (!user) return;
    startTransition(async () => {
      const result = await deleteUserAction({ id: user.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.data.mode === "hard" ? "Account permanently deleted." : "Account archived.",
      );
      router.refresh();
      onOpenChange(false);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete account?</AlertDialogTitle>
          <AlertDialogDescription>
            If <span className="font-medium">{user?.name}</span> has any history — files, notes, or
            recorded activity — the account is archived and hidden. Otherwise it is permanently
            removed. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Deleting…
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

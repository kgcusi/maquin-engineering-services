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
import { deactivateUserAction, reactivateUserAction } from "@/modules/users/actions";
import type { UserRow } from "@/modules/users/queries";

type Mode = "deactivate" | "reactivate";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserRow | null;
  mode: Mode;
};

export function DeactivateConfirm({ open, onOpenChange, user, mode }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useProgressTransition();

  const isDeactivate = mode === "deactivate";

  function onConfirm() {
    if (!user) return;
    startTransition(async () => {
      const run = isDeactivate ? deactivateUserAction : reactivateUserAction;
      const result = await run({ id: user.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(isDeactivate ? "Account deactivated." : "Account reactivated.");
      router.refresh();
      onOpenChange(false);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isDeactivate ? "Deactivate account?" : "Reactivate account?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isDeactivate ? (
              <>
                <span className="font-medium">{user?.name}</span> will be blocked from signing in
                and from any action immediately. An open session stops working within a minute.
              </>
            ) : (
              <>
                <span className="font-medium">{user?.name}</span> will be able to sign in again.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={isDeactivate ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {isDeactivate ? "Deactivating…" : "Reactivating…"}
              </>
            ) : isDeactivate ? (
              "Deactivate"
            ) : (
              "Reactivate"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

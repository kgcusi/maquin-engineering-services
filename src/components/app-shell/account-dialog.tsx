"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useProgressTransition } from "@/hooks/use-progress-transition";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Separator } from "@/components/ui/separator";
import { changePassword } from "@/lib/auth-client";
import { roleLabel } from "@/lib/roles";
import { changePasswordSchema, type ChangePasswordInput } from "@/modules/users/schema";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  email: string;
  role: string | null;
  initials: string;
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-destructive text-xs">
      {message}
    </p>
  );
}

export function AccountDialog({ open, onOpenChange, name, email, role, initials }: Props) {
  const [isPending, startTransition] = useProgressTransition();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  function close(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function onSubmit(values: ChangePasswordInput) {
    startTransition(async () => {
      const { error } = await changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        // Sign out other devices on a password change — the current session stays.
        revokeOtherSessions: true,
      });
      if (error) {
        toast.error(error.message ?? "Couldn't update your password.");
        return;
      }
      toast.success("Password updated.");
      reset();
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Account</DialogTitle>
          <DialogDescription>
            Your details are managed by an administrator. You can change your password here.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/40 flex items-center gap-3 rounded-lg border p-3">
          <Avatar className="size-10 border">
            <AvatarFallback className="text-xs font-medium">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="text-muted-foreground truncate text-xs">{email}</p>
          </div>
          <Badge variant="secondary">{roleLabel(role)}</Badge>
        </div>

        <Separator />

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="currentPassword" required>
              Current password
            </Label>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              disabled={isPending}
              {...register("currentPassword")}
            />
            <FieldError message={errors.currentPassword?.message} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword" required>
              New password
            </Label>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              disabled={isPending}
              {...register("newPassword")}
            />
            <FieldError message={errors.newPassword?.message} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" required>
              Confirm new password
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              disabled={isPending}
              {...register("confirmPassword")}
            />
            <FieldError message={errors.confirmPassword?.message} />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => close(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Updating…
                </>
              ) : (
                "Update password"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useProgressTransition } from "@/hooks/use-progress-transition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ASSIGNABLE_ROLES, ROLE_LABELS } from "@/lib/roles";
import {
  createUserAction,
  resetUserPasswordAction,
  updateUserAction,
} from "@/modules/users/actions";
import {
  createUserSchema,
  editUserFormSchema,
  type CreateUserInput,
  type EditUserFormInput,
} from "@/modules/users/schema";
import type { UserRow } from "@/modules/users/queries";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present → edit that user; absent → create a new one. */
  user?: UserRow | null;
};

export function UserFormDialog({ open, onOpenChange, user }: Props) {
  const editing = Boolean(user);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit user" : "New user"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update this teammate's email, name, or role. The email is their sign-in."
              : "Provision an account. The person signs in with the email and password you set."}
          </DialogDescription>
        </DialogHeader>

        {editing && user ? (
          <EditForm user={user} onDone={() => onOpenChange(false)} />
        ) : (
          <CreateForm onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

const ROLE_OPTIONS = ASSIGNABLE_ROLES.map((value) => ({ value, label: ROLE_LABELS[value] }));

function RoleSelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <Select
      items={ROLE_OPTIONS}
      value={value}
      onValueChange={(v) => onChange(v ?? "")}
      disabled={disabled}
    >
      <SelectTrigger className="w-full" id="role">
        <SelectValue placeholder="Select a role" />
      </SelectTrigger>
      <SelectContent>
        {ROLE_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-destructive text-xs">
      {message}
    </p>
  );
}

function CreateForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useProgressTransition();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "", role: "ENGINEER" },
  });

  function onSubmit(values: CreateUserInput) {
    startTransition(async () => {
      const result = await createUserAction(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Account created.");
      router.refresh();
      onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="name" required>
          Full name
        </Label>
        <Input id="name" autoComplete="off" disabled={isPending} {...register("name")} />
        <FieldError message={errors.name?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email" required>
          Email
        </Label>
        <Input
          id="email"
          type="email"
          autoComplete="off"
          placeholder="you@firm.com"
          disabled={isPending}
          {...register("email")}
        />
        <FieldError message={errors.email?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" required>
          Temporary password
        </Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          disabled={isPending}
          {...register("password")}
        />
        <FieldError message={errors.password?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword" required>
          Confirm password
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

      <div className="space-y-2">
        <Label htmlFor="role" required>
          Role
        </Label>
        <Controller
          control={control}
          name="role"
          render={({ field }) => (
            <RoleSelect value={field.value} onChange={field.onChange} disabled={isPending} />
          )}
        />
        <FieldError message={errors.role?.message} />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Creating…
            </>
          ) : (
            "Create user"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

function EditForm({ user, onDone }: { user: UserRow; onDone: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useProgressTransition();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<EditUserFormInput>({
    resolver: zodResolver(editUserFormSchema),
    defaultValues: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: (user.role as EditUserFormInput["role"]) ?? "ENGINEER",
      newPassword: "",
      confirmPassword: "",
    },
  });

  function onSubmit(values: EditUserFormInput) {
    startTransition(async () => {
      const result = await updateUserAction({
        id: values.id,
        name: values.name,
        email: values.email,
        role: values.role,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      // Optional reset is a separate guarded action (its credential write can't
      // share the identity update's transaction). If it fails, the identity edit
      // already committed — say so rather than silently swallowing it.
      if (values.newPassword) {
        const reset = await resetUserPasswordAction({
          id: values.id,
          newPassword: values.newPassword,
          confirmPassword: values.confirmPassword,
        });
        if (!reset.ok) {
          toast.error(`Changes saved, but the password reset failed: ${reset.error}`);
          router.refresh();
          onDone();
          return;
        }
        toast.success("Changes saved and password reset.");
      } else {
        toast.success("Changes saved.");
      }

      router.refresh();
      onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <input type="hidden" {...register("id")} />

      <div className="space-y-2">
        <Label htmlFor="email" required>
          Email
        </Label>
        <Input
          id="email"
          type="email"
          autoComplete="off"
          placeholder="you@firm.com"
          disabled={isPending}
          {...register("email")}
        />
        <FieldError message={errors.email?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="name" required>
          Full name
        </Label>
        <Input id="name" autoComplete="off" disabled={isPending} {...register("name")} />
        <FieldError message={errors.name?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="role" required>
          Role
        </Label>
        <Controller
          control={control}
          name="role"
          render={({ field }) => (
            <RoleSelect value={field.value} onChange={field.onChange} disabled={isPending} />
          )}
        />
        <FieldError message={errors.role?.message} />
      </div>

      <Separator />

      <div className="space-y-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">Reset password</p>
          <p className="text-muted-foreground text-xs">
            Leave blank to keep their current password. Setting a new one signs them out of all
            sessions and is recorded in the audit trail.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="newPassword">New password</Label>
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
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            disabled={isPending}
            {...register("confirmPassword")}
          />
          <FieldError message={errors.confirmPassword?.message} />
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Saving…
            </>
          ) : (
            "Save changes"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

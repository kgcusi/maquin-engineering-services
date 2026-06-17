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
import { ASSIGNABLE_ROLES, ROLE_LABELS } from "@/lib/roles";
import { createUserAction, updateUserAction } from "@/modules/users/actions";
import {
  createUserSchema,
  updateUserSchema,
  type CreateUserInput,
  type UpdateUserInput,
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
    <Dialog open={open} onOpenChange={onOpenChange}>
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
  } = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: (user.role as UpdateUserInput["role"]) ?? "ENGINEER",
    },
  });

  function onSubmit(values: UpdateUserInput) {
    startTransition(async () => {
      const result = await updateUserAction(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Changes saved.");
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

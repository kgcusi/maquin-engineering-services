"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useProgressTransition } from "@/hooks/use-progress-transition";
import { createClientAction, updateClientAction } from "@/modules/clients/actions";
import {
  createClientSchema,
  type CreateClientFormValues,
  type CreateClientInput,
} from "@/modules/clients/schema";
import type { ClientRow } from "@/modules/clients/queries";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-destructive text-xs">
      {message}
    </p>
  );
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: ClientRow | null;
};

export function ClientFormDialog({ open, onOpenChange, client }: Props) {
  const editing = Boolean(client);
  return (
    <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit client" : "New client"}</DialogTitle>
          <DialogDescription>
            {editing ? "Update this client's details." : "Add a client to track projects against."}
          </DialogDescription>
        </DialogHeader>
        <ClientForm
          key={client?.id ?? "new"}
          client={client ?? null}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function ClientForm({ client, onDone }: { client: ClientRow | null; onDone: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useProgressTransition();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CreateClientFormValues, unknown, CreateClientInput>({
    resolver: zodResolver(createClientSchema),
    defaultValues: {
      name: client?.name ?? "",
      contactPerson: client?.contactPerson ?? "",
      phone: client?.phone ?? "",
      email: client?.email ?? "",
      address: client?.address ?? "",
      isActive: client?.isActive ?? true,
      notes: client?.notes ?? "",
    },
  });

  function onSubmit(values: CreateClientInput) {
    startTransition(async () => {
      const result = client
        ? await updateClientAction({ ...values, id: client.id })
        : await createClientAction(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(client ? "Client updated." : "Client added.");
      router.refresh();
      onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="name" required>
          Client name
        </Label>
        <Input id="name" autoComplete="off" disabled={isPending} {...register("name")} />
        <FieldError message={errors.name?.message} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contactPerson">Contact person</Label>
          <Input
            id="contactPerson"
            autoComplete="off"
            disabled={isPending}
            {...register("contactPerson")}
          />
          <FieldError message={errors.contactPerson?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" autoComplete="off" disabled={isPending} {...register("phone")} />
          <FieldError message={errors.phone?.message} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="off"
          disabled={isPending}
          {...register("email")}
        />
        <FieldError message={errors.email?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Input id="address" autoComplete="off" disabled={isPending} {...register("address")} />
        <FieldError message={errors.address?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Remarks</Label>
        <Textarea id="notes" rows={3} disabled={isPending} {...register("notes")} />
        <FieldError message={errors.notes?.message} />
      </div>

      <Controller
        control={control}
        name="isActive"
        render={({ field }) => (
          <div className="flex items-center justify-between gap-4 rounded-lg border px-3.5 py-3">
            <div className="space-y-0.5">
              <Label htmlFor="isActive">Active</Label>
              <p className="text-muted-foreground text-xs">
                Inactive clients stay in the directory but can&apos;t be selected in other modules.
              </p>
            </div>
            <Switch
              id="isActive"
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked)}
              disabled={isPending}
            />
          </div>
        )}
      />

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> {client ? "Saving…" : "Adding…"}
            </>
          ) : client ? (
            "Save changes"
          ) : (
            "Add client"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

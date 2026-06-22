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
import { createSupplierAction, updateSupplierAction } from "@/modules/suppliers/actions";
import {
  createSupplierSchema,
  type CreateSupplierFormValues,
  type CreateSupplierInput,
} from "@/modules/suppliers/schema";
import type { SupplierRow } from "@/modules/suppliers/queries";

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
  /** Present → edit; absent → create. */
  supplier?: SupplierRow | null;
};

export function SupplierFormDialog({ open, onOpenChange, supplier }: Props) {
  const editing = Boolean(supplier);
  return (
    <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit supplier" : "New supplier"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update this supplier's contact and terms."
              : "Add a vendor for stock-in and expenses."}
          </DialogDescription>
        </DialogHeader>
        {/* key remounts the form with fresh defaults each time the target changes */}
        <SupplierForm
          key={supplier?.id ?? "new"}
          supplier={supplier ?? null}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function SupplierForm({ supplier, onDone }: { supplier: SupplierRow | null; onDone: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useProgressTransition();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CreateSupplierFormValues, unknown, CreateSupplierInput>({
    resolver: zodResolver(createSupplierSchema),
    defaultValues: {
      name: supplier?.name ?? "",
      contactPerson: supplier?.contactPerson ?? "",
      phone: supplier?.phone ?? "",
      email: supplier?.email ?? "",
      address: supplier?.address ?? "",
      tin: supplier?.tin ?? "",
      paymentTerms: supplier?.paymentTerms ?? "",
      isActive: supplier?.isActive ?? true,
      notes: supplier?.notes ?? "",
    },
  });

  function onSubmit(values: CreateSupplierInput) {
    startTransition(async () => {
      const result = supplier
        ? await updateSupplierAction({ ...values, id: supplier.id })
        : await createSupplierAction(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(supplier ? "Supplier updated." : "Supplier added.");
      router.refresh();
      onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="name" required>
          Supplier name
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="tin">TIN</Label>
          <Input id="tin" autoComplete="off" disabled={isPending} {...register("tin")} />
          <FieldError message={errors.tin?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="paymentTerms">Payment terms</Label>
          <Input
            id="paymentTerms"
            autoComplete="off"
            placeholder="e.g. Net 30"
            disabled={isPending}
            {...register("paymentTerms")}
          />
          <FieldError message={errors.paymentTerms?.message} />
        </div>
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
                Inactive suppliers stay in the directory but can&apos;t be selected in other
                modules.
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
              <Loader2 className="size-4 animate-spin" /> {supplier ? "Saving…" : "Adding…"}
            </>
          ) : supplier ? (
            "Save changes"
          ) : (
            "Add supplier"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

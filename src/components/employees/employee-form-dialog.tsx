"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CreatableCombobox } from "@/components/ui/creatable-combobox";
import { DatePicker } from "@/components/ui/date-picker";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useProgressTransition } from "@/hooks/use-progress-transition";
import { EMPLOYMENT_TYPES, RATE_UNITS } from "@/lib/lookups";
import { createEmployeeAction, updateEmployeeAction } from "@/modules/employees/actions";
import { createEmployeeSchema, type CreateEmployeeInput } from "@/modules/employees/schema";
import type { EmployeeRow } from "@/modules/employees/queries";

// `items` lets Base UI's <SelectValue> resolve the selected code to its label in
// the trigger (without it, the trigger shows the raw code).
const EMPLOYMENT_TYPE_ITEMS = EMPLOYMENT_TYPES.map((t) => ({ value: t.code, label: t.label }));
const RATE_UNIT_ITEMS = RATE_UNITS.map((u) => ({ value: u.code, label: u.label }));

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
  employee?: EmployeeRow | null;
  /** Existing positions, for the creatable Position picker. */
  positions: string[];
};

export function EmployeeFormDialog({ open, onOpenChange, employee, positions }: Props) {
  const editing = Boolean(employee);
  return (
    <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit employee" : "New employee"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update this person's directory record."
              : "Add someone to the workforce directory."}
          </DialogDescription>
        </DialogHeader>
        <EmployeeForm
          key={employee?.id ?? "new"}
          employee={employee ?? null}
          positions={positions}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function EmployeeForm({
  employee,
  positions,
  onDone,
}: {
  employee: EmployeeRow | null;
  positions: string[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useProgressTransition();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CreateEmployeeInput>({
    resolver: zodResolver(createEmployeeSchema),
    defaultValues: {
      fullName: employee?.fullName ?? "",
      position: employee?.position ?? "",
      employmentType: (employee?.employmentType as CreateEmployeeInput["employmentType"]) ?? "",
      dateHired: employee?.dateHired ?? "",
      phone: employee?.phone ?? "",
      email: employee?.email ?? "",
      address: employee?.address ?? "",
      rate: employee?.rate ?? "",
      rateUnit: (employee?.rateUnit as CreateEmployeeInput["rateUnit"]) ?? "DAILY",
      notes: employee?.notes ?? "",
    },
  });

  function onSubmit(values: CreateEmployeeInput) {
    startTransition(async () => {
      const result = employee
        ? await updateEmployeeAction({ ...values, id: employee.id })
        : await createEmployeeAction(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(employee ? "Employee updated." : "Employee added.");
      router.refresh();
      onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="fullName" required>
          Full name
        </Label>
        <Input id="fullName" autoComplete="off" disabled={isPending} {...register("fullName")} />
        <FieldError message={errors.fullName?.message} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="position">Position</Label>
          <Controller
            control={control}
            name="position"
            render={({ field }) => (
              <CreatableCombobox
                id="position"
                options={positions}
                value={field.value ?? ""}
                onValueChange={field.onChange}
                placeholder="Select or type a position"
                disabled={isPending}
                aria-label="Position"
              />
            )}
          />
          <FieldError message={errors.position?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="employmentType">Employment type</Label>
          <Controller
            control={control}
            name="employmentType"
            render={({ field }) => (
              <Select
                items={EMPLOYMENT_TYPE_ITEMS}
                value={field.value || null}
                onValueChange={(v) => field.onChange(v ?? "")}
                disabled={isPending}
              >
                <SelectTrigger id="employmentType" className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_TYPES.map((t) => (
                    <SelectItem key={t.code} value={t.code}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FieldError message={errors.employmentType?.message} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="dateHired">Date hired</Label>
          <Controller
            control={control}
            name="dateHired"
            render={({ field }) => (
              <DatePicker
                id="dateHired"
                value={field.value ?? ""}
                onChange={field.onChange}
                disabled={isPending}
                aria-label="Date hired"
              />
            )}
          />
          <FieldError message={errors.dateHired?.message} />
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
          <Label htmlFor="rate">Pay rate</Label>
          <Input
            id="rate"
            inputMode="decimal"
            placeholder="0.00"
            autoComplete="off"
            disabled={isPending}
            {...register("rate")}
          />
          <FieldError message={errors.rate?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="rateUnit">Rate basis</Label>
          <Controller
            control={control}
            name="rateUnit"
            render={({ field }) => (
              <Select
                items={RATE_UNIT_ITEMS}
                value={field.value}
                onValueChange={(v) => field.onChange(v ?? "DAILY")}
                disabled={isPending}
              >
                <SelectTrigger id="rateUnit" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RATE_UNITS.map((u) => (
                    <SelectItem key={u.code} value={u.code}>
                      {u.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FieldError message={errors.rateUnit?.message} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Remarks</Label>
        <Textarea id="notes" rows={3} disabled={isPending} {...register("notes")} />
        <FieldError message={errors.notes?.message} />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> {employee ? "Saving…" : "Adding…"}
            </>
          ) : employee ? (
            "Save changes"
          ) : (
            "Add employee"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

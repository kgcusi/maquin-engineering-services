"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Clock, Coins, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useProgressTransition } from "@/hooks/use-progress-transition";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURRENCIES, TIMEZONES, type AppSettings } from "@/lib/settings";
import { updateSettingsAction } from "@/modules/settings/actions";
import { updateSettingsSchema, type UpdateSettingsInput } from "@/modules/settings/schema";

const TIMEZONE_ITEMS = TIMEZONES.map((tz) => ({ value: tz.code, label: tz.label }));
// `items` lets <SelectValue> show the label (not the raw code) in the trigger.
const CURRENCY_ITEMS = CURRENCIES.map((c) => ({ value: c.code, label: c.label }));

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-destructive text-xs">
      {message}
    </p>
  );
}

// Live preview helpers — show the chosen settings actually applied. Wrapped in
// try/catch so an exotic zone/currency can never throw during typing.
function formatTime(timeZone: string, at: Date): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "medium",
      timeZone,
    }).format(at);
  } catch {
    return "—";
  }
}

function formatSample(currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(1234567.89);
  } catch {
    return "—";
  }
}

export function SettingsForm({ settings }: { settings: AppSettings }) {
  const router = useRouter();
  const [isPending, startTransition] = useProgressTransition();
  const [now, setNow] = useState<Date | null>(null);

  // A live clock for the preview — client-only (so there's no SSR/hydration time
  // mismatch) and ticking, so the chosen zone reads as real.
  useEffect(() => {
    const update = () => setNow(new Date());
    // First paint via rAF (async, so it's not a synchronous setState-in-effect)
    // then tick each second. Server/first-client render shows "—" → no mismatch.
    const raf = requestAnimationFrame(update);
    const id = setInterval(update, 1000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(id);
    };
  }, []);

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<UpdateSettingsInput>({
    resolver: zodResolver(updateSettingsSchema),
    defaultValues: { timezone: settings.timezone, currency: settings.currency },
  });

  const timezone = useWatch({ control, name: "timezone" });
  const currency = useWatch({ control, name: "currency" });

  function onSubmit(values: UpdateSettingsInput) {
    startTransition(async () => {
      const result = await updateSettingsAction(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.data.changed ? "Settings saved." : "No changes to save.");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label required>Timezone</Label>
          <Controller
            control={control}
            name="timezone"
            render={({ field }) => (
              <Combobox
                items={TIMEZONE_ITEMS}
                value={field.value}
                onValueChange={(v) => field.onChange(v ?? settings.timezone)}
                placeholder="Select a timezone"
                searchPlaceholder="Search timezones…"
                emptyText="No timezone found."
                disabled={isPending}
                aria-label="Firm timezone"
              />
            )}
          />
          <p className="text-muted-foreground text-xs">
            Dates and times across the app render in this zone.
          </p>
          <FieldError message={errors.timezone?.message} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="currency" required>
            Currency
          </Label>
          <Controller
            control={control}
            name="currency"
            render={({ field }) => (
              <Select
                items={CURRENCY_ITEMS}
                value={field.value}
                onValueChange={(v) => field.onChange(v ?? settings.currency)}
                disabled={isPending}
              >
                <SelectTrigger id="currency" className="w-full">
                  <SelectValue placeholder="Select a currency" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((option) => (
                    <SelectItem key={option.code} value={option.code}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <p className="text-muted-foreground text-xs">Used to format monetary amounts.</p>
          <FieldError message={errors.currency?.message} />
        </div>
      </div>

      <dl className="bg-muted/40 grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
        <div className="flex items-start gap-2.5">
          <Clock className="text-muted-foreground mt-0.5 size-4 shrink-0" />
          <div className="min-w-0 space-y-0.5">
            <dt className="text-muted-foreground text-xs">Current time</dt>
            <dd className="font-medium tabular-nums">{now ? formatTime(timezone, now) : "—"}</dd>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <Coins className="text-muted-foreground mt-0.5 size-4 shrink-0" />
          <div className="min-w-0 space-y-0.5">
            <dt className="text-muted-foreground text-xs">Sample amount</dt>
            <dd className="font-medium tabular-nums">{formatSample(currency)}</dd>
          </div>
        </div>
      </dl>

      <div className="flex items-center justify-end border-t pt-5">
        <Button type="submit" disabled={isPending || !isDirty}>
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Saving…
            </>
          ) : (
            "Save changes"
          )}
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Loader2, MailCheck, Send } from "lucide-react";
import { toast } from "sonner";

import { useProgressTransition } from "@/hooks/use-progress-transition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EmailConfigView } from "@/lib/email-settings";
import { testEmailConnectionAction, updateEmailSettingsAction } from "@/modules/settings/actions";
import {
  updateEmailSettingsSchema,
  type UpdateEmailSettingsInput,
} from "@/modules/settings/schema";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-destructive text-xs">
      {message}
    </p>
  );
}

export function EmailSettingsForm({ config }: { config: EmailConfigView }) {
  const router = useRouter();
  const [isSaving, startSaving] = useProgressTransition();
  const [isTesting, startTesting] = useProgressTransition();
  const busy = isSaving || isTesting;

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<UpdateEmailSettingsInput>({
    resolver: zodResolver(updateEmailSettingsSchema),
    defaultValues: { fromAddress: config.fromAddress ?? "", apiKey: "" },
  });

  // A freshly-typed key isn't saved yet; the test validates the SAVED key, so we
  // make the user save it first rather than silently testing the old one.
  const typedKey = useWatch({ control, name: "apiKey" });
  const hasUnsavedKey = (typedKey ?? "").trim().length > 0;

  function onSubmit(values: UpdateEmailSettingsInput) {
    startSaving(async () => {
      const result = await updateEmailSettingsAction(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.data.changed ? "Email settings saved." : "No changes to save.");
      // Drop the key from form state (never echo it back) and clear dirty so the
      // Test button enables; the refreshed config prop drives the status badge.
      reset({ fromAddress: values.fromAddress, apiKey: "" });
      router.refresh();
    });
  }

  function onTest() {
    startTesting(async () => {
      const result = await testEmailConnectionAction({});
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const { restricted, domains } = result.data;
      if (restricted) {
        toast.success("API key is valid (sending-only — can't list domains).");
        return;
      }
      const verified = domains.filter((d) => d.status === "verified");
      if (verified.length > 0) {
        toast.success(
          `Connection OK — ${verified.length} verified domain${verified.length > 1 ? "s" : ""}: ${verified
            .map((d) => d.name)
            .join(", ")}`,
        );
      } else if (domains.length > 0) {
        toast.warning("Key works, but no domain is verified yet in Resend.");
      } else {
        toast.warning("Key works, but no sending domains are configured in Resend yet.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <div className="space-y-2">
        <Label htmlFor="email-from">Sender address</Label>
        <Controller
          control={control}
          name="fromAddress"
          render={({ field }) => (
            <Input
              id="email-from"
              placeholder="MAQUIN Engineering <no-reply@maquin.com>"
              autoComplete="off"
              disabled={busy}
              aria-invalid={!!errors.fromAddress}
              {...field}
            />
          )}
        />
        <p className="text-muted-foreground text-xs">
          The “From” shown on every email. Use an address on a domain verified in Resend.
        </p>
        <FieldError message={errors.fromAddress?.message} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="resend-key">Resend API key</Label>
          {config.apiKeyConfigured ? (
            <Badge variant="secondary" className="gap-1">
              <KeyRound className="size-3" />
              {config.apiKeyHint}
            </Badge>
          ) : (
            <Badge variant="outline">Not set</Badge>
          )}
        </div>
        <Controller
          control={control}
          name="apiKey"
          render={({ field }) => (
            <Input
              id="resend-key"
              type="password"
              autoComplete="off"
              placeholder={config.apiKeyConfigured ? "Leave blank to keep the current key" : "re_…"}
              disabled={busy}
              aria-invalid={!!errors.apiKey}
              {...field}
            />
          )}
        />
        <p className="text-muted-foreground text-xs">
          Stored securely and never shown again. Leave blank to keep the saved key.
        </p>
        <FieldError message={errors.apiKey?.message} />
      </div>

      <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-muted-foreground text-xs">
          {hasUnsavedKey
            ? "Save the new key before testing the connection."
            : "Testing validates the saved key with Resend — no email is sent."}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onTest}
            disabled={busy || !config.apiKeyConfigured || hasUnsavedKey}
          >
            {isTesting ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Testing…
              </>
            ) : (
              <>
                <Send className="size-4" /> Test connection
              </>
            )}
          </Button>
          <Button type="submit" disabled={busy || !isDirty}>
            {isSaving ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Saving…
              </>
            ) : (
              <>
                <MailCheck className="size-4" /> Save changes
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}

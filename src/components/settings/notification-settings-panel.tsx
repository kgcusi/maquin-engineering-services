"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Loader2, Mail, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useProgressTransition } from "@/hooks/use-progress-transition";
import type { NotificationChannel, NotificationEventKey } from "@/lib/notification-events";
import { cn } from "@/lib/utils";
import {
  drainNotificationsAction,
  updateNotificationSettingsAction,
} from "@/modules/notifications/actions";
import type { NotificationSettingRow } from "@/modules/notifications/queries";

type RowState = {
  eventKey: NotificationEventKey;
  enabled: boolean;
  channels: NotificationChannel[];
};

const CHANNEL_META: { value: NotificationChannel; label: string; icon: typeof Bell }[] = [
  { value: "IN_APP", label: "In-app", icon: Bell },
  { value: "EMAIL", label: "Email", icon: Mail },
];

// Order-insensitive snapshot used for the dirty check.
function snapshot(rows: RowState[]): string {
  return JSON.stringify(
    rows.map((r) => ({ k: r.eventKey, e: r.enabled, c: [...r.channels].sort() })),
  );
}

function ChannelChip({
  active,
  disabled,
  onToggle,
  icon: Icon,
  label,
}: {
  active: boolean;
  disabled: boolean;
  onToggle: () => void;
  icon: typeof Bell;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:bg-muted",
        disabled && "pointer-events-none opacity-40",
      )}
    >
      <Icon className="size-3" />
      {label}
    </button>
  );
}

export function NotificationSettingsPanel({
  events,
  emailConfigured,
}: {
  events: NotificationSettingRow[];
  emailConfigured: boolean;
}) {
  const router = useRouter();
  const [isSaving, startSaving] = useProgressTransition();
  const [isDraining, startDraining] = useProgressTransition();
  const busy = isSaving || isDraining;

  const initial = useMemo<RowState[]>(
    () => events.map((e) => ({ eventKey: e.eventKey, enabled: e.enabled, channels: e.channels })),
    [events],
  );
  const [rows, setRows] = useState<RowState[]>(initial);
  const labelByKey = useMemo(() => new Map(events.map((e) => [e.eventKey, e])), [events]);

  const isDirty = snapshot(rows) !== snapshot(initial);
  const enabledCount = rows.filter((r) => r.enabled).length;
  const emailWanted = rows.some((r) => r.enabled && r.channels.includes("EMAIL"));

  function setRow(eventKey: NotificationEventKey, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r) => (r.eventKey === eventKey ? { ...r, ...patch } : r)));
  }

  function toggleEnabled(row: RowState) {
    // Re-enabling an event that was stripped of channels gets In-app back, so it
    // never lands "on with nothing to send" (which the action would reject anyway).
    const channels = !row.enabled && row.channels.length === 0 ? ["IN_APP" as const] : row.channels;
    setRow(row.eventKey, { enabled: !row.enabled, channels });
  }

  function toggleChannel(row: RowState, channel: NotificationChannel) {
    const channels = row.channels.includes(channel)
      ? row.channels.filter((c) => c !== channel)
      : [...row.channels, channel];
    setRow(row.eventKey, { channels });
  }

  function onSave() {
    startSaving(async () => {
      const result = await updateNotificationSettingsAction({ events: rows });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.data.changed > 0
          ? `Saved — ${result.data.changed} event${result.data.changed === 1 ? "" : "s"} updated.`
          : "No changes to save.",
      );
      router.refresh();
    });
  }

  function onDrain() {
    startDraining(async () => {
      const result = await drainNotificationsAction({});
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const { dispatched, delivered } = result.data;
      const parts = [`${dispatched.created} notification${dispatched.created === 1 ? "" : "s"}`];
      if (delivered.delivered > 0) parts.push(`${delivered.delivered} email sent`);
      if (delivered.skipped > 0) parts.push(`${delivered.skipped} email queued (no Resend)`);
      toast.success(
        dispatched.processed === 0
          ? "Queue is empty — nothing to process."
          : `Queue processed: ${parts.join(", ")}.`,
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <ul className="divide-border divide-y rounded-lg border">
        {rows.map((row) => {
          const meta = labelByKey.get(row.eventKey);
          return (
            <li
              key={row.eventKey}
              className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p
                  className={cn(
                    "truncate text-sm font-medium",
                    !row.enabled && "text-muted-foreground",
                  )}
                >
                  {meta?.label ?? row.eventKey}
                </p>
                <p className="text-muted-foreground text-xs">{meta?.recipientLabel}</p>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-1.5">
                  {CHANNEL_META.map((c) => (
                    <ChannelChip
                      key={c.value}
                      icon={c.icon}
                      label={c.label}
                      active={row.channels.includes(c.value)}
                      disabled={busy || !row.enabled}
                      onToggle={() => toggleChannel(row, c.value)}
                    />
                  ))}
                </div>
                <Switch
                  checked={row.enabled}
                  onCheckedChange={() => toggleEnabled(row)}
                  disabled={busy}
                  aria-label={`Enable ${meta?.label ?? row.eventKey}`}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-xs">
          {enabledCount === 0
            ? "Every event is off — no notifications send."
            : `${enabledCount} event${enabledCount === 1 ? "" : "s"} on.`}
          {emailWanted && !emailConfigured
            ? " Email channels won’t deliver until Resend is set up under Email delivery."
            : ""}
        </p>
        <Button type="button" onClick={onSave} disabled={busy || !isDirty}>
          {isSaving ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Saving…
            </>
          ) : (
            <>
              <Save className="size-4" /> Save changes
            </>
          )}
        </Button>
      </div>

      <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground max-w-md text-xs">
          Notifications queue when an event fires and are delivered by the scheduled cron. On
          localhost the cron never runs — process the queue here to push pending items to the bell
          and email.
        </p>
        <Button type="button" variant="outline" onClick={onDrain} disabled={busy}>
          {isDraining ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Processing…
            </>
          ) : (
            <>
              <RefreshCw className="size-4" /> Process queue now
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { useProgressTransition } from "@/hooks/use-progress-transition";
import { Button } from "@/components/ui/button";
import { sendTestNotificationAction } from "@/modules/notifications/actions";

export function NotificationTestPanel({ canSend }: { canSend: boolean }) {
  const router = useRouter();
  const [isSending, start] = useProgressTransition();
  const [lastId, setLastId] = useState<string | null>(null);

  function onSend() {
    start(async () => {
      const res = await sendTestNotificationAction({});
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setLastId(res.data.messageId);
      toast.success("Test notification sent — check your inbox and the bell.");
      // Refresh so the streamed bell picks up the new unread in-app notice.
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-muted-foreground space-y-1 text-xs">
        <p>
          {canSend
            ? "Sends a real email to your address and drops an in-app notice — an end-to-end delivery check."
            : "Add and save a Resend API key and sender address under Email delivery first."}
        </p>
        {lastId ? <p className="text-foreground">Last Resend message id: {lastId}</p> : null}
      </div>
      <Button type="button" onClick={onSend} disabled={isSending || !canSend}>
        {isSending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Sending…
          </>
        ) : (
          <>
            <Send className="size-4" /> Send test notification
          </>
        )}
      </Button>
    </div>
  );
}

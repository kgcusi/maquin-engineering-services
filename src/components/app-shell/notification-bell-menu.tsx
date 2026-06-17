"use client";

import { useRouter } from "next/navigation";
import { Bell, BellRing, Check, Inbox } from "lucide-react";
import { toast } from "sonner";

import { useProgressTransition } from "@/hooks/use-progress-transition";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/modules/notifications/actions";
import type { BellNotification } from "@/modules/notifications/queries";
import { cn } from "@/lib/utils";

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 45) return "just now";
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

export function NotificationBellMenu({
  unread,
  items,
}: {
  unread: number;
  items: BellNotification[];
}) {
  const router = useRouter();
  const [isPending, start] = useProgressTransition();

  function markOne(id: string) {
    start(async () => {
      const res = await markNotificationReadAction({ id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  }

  function markAll() {
    start(async () => {
      const res = await markAllNotificationsReadAction({});
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
            className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring relative inline-flex size-8 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none"
          />
        }
      >
        {unread > 0 ? <BellRing className="size-5" /> : <Bell className="size-5" />}
        {unread > 0 ? (
          <span className="bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-semibold tabular-nums">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2.5">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 ? (
            <button
              type="button"
              onClick={markAll}
              disabled={isPending}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs disabled:opacity-50"
            >
              <Check className="size-3.5" />
              Mark all read
            </button>
          ) : null}
        </div>
        <DropdownMenuSeparator className="m-0" />

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <Inbox className="text-muted-foreground/60 size-7" />
            <p className="text-sm font-medium">You’re all caught up</p>
            <p className="text-muted-foreground text-xs">
              New activity will show up here as it happens.
            </p>
          </div>
        ) : (
          <ul className="max-h-[22rem] overflow-y-auto py-1">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  disabled={isPending || n.read}
                  onClick={() => markOne(n.id)}
                  className={cn(
                    "hover:bg-accent flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors",
                    !n.read && "bg-primary/5",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      n.read ? "bg-transparent" : "bg-primary",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{n.subject}</span>
                    <span className="text-muted-foreground line-clamp-2 block text-xs">
                      {n.body}
                    </span>
                    <span className="text-muted-foreground/80 mt-0.5 block text-[11px]">
                      {timeAgo(n.createdAt)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

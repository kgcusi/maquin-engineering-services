import type { Route } from "next";
import { Link } from "react-transition-progress/next";

import type { BellNotification } from "@/modules/notifications/queries";
import { cn } from "@/lib/utils";

// Server-rendered (the dashboard is dynamic), so a request-time relative stamp is
// accurate without any client hydration. Marking-read stays in the topbar bell —
// these rows are read-only deep-links into the work that happened.
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

function Row({ n }: { n: BellNotification }) {
  const inner = (
    <>
      <span
        aria-hidden
        className={cn(
          "mt-1.5 size-2 shrink-0 rounded-full",
          n.read ? "bg-transparent" : "bg-primary",
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{n.subject}</span>
        <span className="text-muted-foreground line-clamp-2 block text-xs">{n.body}</span>
        <span className="text-muted-foreground/80 mt-0.5 block text-[11px]">
          {timeAgo(n.createdAt)}
        </span>
      </span>
    </>
  );

  return n.link ? (
    <Link
      href={n.link as Route}
      className="hover:bg-accent/40 -mx-2 flex items-start gap-2.5 rounded-md px-2 py-2 transition-colors"
    >
      {inner}
    </Link>
  ) : (
    <div className="flex items-start gap-2.5 px-0 py-2">{inner}</div>
  );
}

export function RecentActivity({ items }: { items: BellNotification[] }) {
  return (
    <ul className="divide-border/70 divide-y">
      {items.map((n) => (
        <li key={n.id}>
          <Row n={n} />
        </li>
      ))}
    </ul>
  );
}

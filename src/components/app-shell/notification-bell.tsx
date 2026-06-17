import { getSession } from "@/lib/session";
import { getUnreadCount, listRecentNotifications } from "@/modules/notifications/queries";

import { NotificationBellMenu } from "./notification-bell-menu";

// Server slot: reads the CACHED session (deduped with the user menu via React
// cache), then the user's own in-app notifications (DYNAMIC). Streamed inside
// <Suspense> by the topbar so the chrome still prerenders.
export async function NotificationBell() {
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) return null;

  const [unread, items] = await Promise.all([
    getUnreadCount(userId),
    listRecentNotifications(userId, 10),
  ]);

  return <NotificationBellMenu unread={unread} items={items} />;
}

import { revalidateTag, updateTag } from "next/cache";

import type { Database } from "@/db/client";
import { outbox } from "@/db/schema/outbox";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

// ── Cache-tag taxonomy (docs/17 §5) ─────────────────────────────────────────
// Dynamic-by-default; invalidate narrowly and SYNCHRONOUSLY in the Server Action
// after commit — never via the async outbox.
export const cacheTags = {
  settings: "settings",
  templates: "templates",
  checklists: "checklists",
  dashboard: (userId: string) => `dashboard:${userId}`,
  projectBudget: (projectId: string) => `project:${projectId}:budget`,
  projectMaterials: (projectId: string) => `project:${projectId}:materials`,
  projectProgress: (projectId: string) => `project:${projectId}:progress`,
} as const;

/** Mark tags stale after a committed write (stale-while-revalidate). */
export function revalidate(...tags: string[]): void {
  for (const tag of tags) revalidateTag(tag, "max");
}

/** Read-your-writes invalidation within the same request (Cache Components). */
export function revalidateNow(...tags: string[]): void {
  for (const tag of tags) updateTag(tag);
}

// ── Domain events → transactional outbox (docs/16 §6) ───────────────────────
// Emitted inside the action's transaction; the Vercel Cron drain dispatches them
// (email/jobs) in Stage 1. Recording the event can never fail independently of
// the write it belongs to.
export type DomainEvent = { type: string; payload: Record<string, unknown> };

export async function emitEvent(tx: Tx, event: DomainEvent): Promise<void> {
  await tx.insert(outbox).values({
    eventType: event.type,
    payload: event.payload,
  });
}

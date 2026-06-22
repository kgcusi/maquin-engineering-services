import { type ProjectStatus } from "@/lib/statuses";

// Pure project domain rules — NO server imports, so they're unit-testable and
// safe to import from client components (e.g. the status control's option list).

// The manual lifecycle (docs/17 §9-Group A): PLANNING → ACTIVE ⇄ ON_HOLD,
// ACTIVE → COMPLETED, and any non-terminal → CANCELLED. COMPLETED/CANCELLED are
// terminal. Completion is a human sign-off — never derived from progress.
const TRANSITIONS: Record<ProjectStatus, readonly ProjectStatus[]> = {
  PLANNING: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["ON_HOLD", "COMPLETED", "CANCELLED"],
  ON_HOLD: ["ACTIVE", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

/** Whether a project may move from `from` to `to` (a no-op `from===to` is false). */
export function canTransitionProject(from: ProjectStatus, to: ProjectStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** The statuses reachable from the current one (drives the status-control menu). */
export function allowedNextStatuses(from: ProjectStatus): readonly ProjectStatus[] {
  return TRANSITIONS[from] ?? [];
}

/** Normalize a team selection: a lead is never also a plain member, and member
 *  ids are de-duped. Empty lead → null. */
export function normalizeTeam(
  leadId: string | null | undefined,
  memberIds: readonly string[],
): { leadId: string | null; memberIds: string[] } {
  const members = new Set(memberIds.filter((id) => id && id.length > 0));
  const lead = leadId && leadId.length > 0 ? leadId : null;
  if (lead) members.delete(lead);
  return { leadId: lead, memberIds: [...members] };
}

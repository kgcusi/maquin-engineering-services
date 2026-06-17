import { ActionError, isHiddenRole } from "@/lib/rbac";

// Defense-in-depth: even though hidden users never appear in any list
// (visibleUserWhere), a forged/guessed id must not let an admin act on the hidden
// webmaster. Every user-targeting action calls this on the TARGET's role.
export function assertNotHidden(role: string | null | undefined): void {
  if (isHiddenRole(role)) {
    throw new ActionError("This account can't be managed here.");
  }
}

// Guard against self-lockout: you can't deactivate your own account.
export function assertNotSelf(actorId: string, targetId: string): void {
  if (actorId === targetId) {
    throw new ActionError("You can't change your own account status.");
  }
}

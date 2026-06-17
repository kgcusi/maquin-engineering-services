// Human-readable labels for audit `action` keys and `entity_type` values. The
// stored values are stable machine keys (e.g. `user.deactivated`, `user`); the
// viewer shows the humanised form (`User Deactivated`, `User`). Pure — no server
// imports — so it is client- and test-safe. Deriving labels generically means
// new actions logged by later stages get a sensible label with no extra wiring.

// Tokens that should stay upper-cased rather than title-cased.
const ACRONYMS = new Set(["dsr", "mr", "id", "ip", "url", "pdf", "csv", "po"]);

export function humanizeKey(key: string): string {
  return key
    .split(/[._\-\s]+/)
    .filter(Boolean)
    .map((word) =>
      ACRONYMS.has(word.toLowerCase())
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}

export function actionLabel(action: string): string {
  return humanizeKey(action);
}

export function entityTypeLabel(entityType: string): string {
  return humanizeKey(entityType);
}

// Pure helpers — no DB, no server deps, so they're unit-tested directly.

export const INSPECTION_ENTITY = "inspection" as const;
// Polymorphic `attachments` entity types: photos are presigned against the
// inspection (the row exists at upload time) then re-homed onto the specific
// item-result row when the attempt is saved (docs/17 §10.16).
export const INSPECTION_ITEM_RESULT_ENTITY = "inspection_item_result" as const;
export const INSPECTION_ITEM_PHOTO_ENTITY = "inspection_item_photo" as const;

/** An inspection still awaiting its FIRST outcome — the only state that can be
 *  WITHDRAWN. (Recording is also allowed here.) */
export function isInspectionOpen(status: string): boolean {
  return status === "REQUESTED";
}

/** A recorded inspection can be RE-INSPECTED in place (reopen + append an attempt,
 *  docs/17 §10.16) — typically after a FAIL, but a PASS may be re-checked too. */
export function canReinspect(status: string): boolean {
  return status === "PASSED" || status === "FAILED";
}

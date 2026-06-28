import { z } from "zod";

import { INSPECTION_ITEM_RESULTS } from "@/lib/statuses";

// Pure Zod — shared by the guarded actions and unit tests (no server imports).

const optionalText = (max: number) =>
  z.union([z.literal(""), z.string().trim().max(max)]).optional();
const optionalDate = z
  .union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date")])
  .optional();
const optionalUuid = z.union([z.literal(""), z.string().uuid()]).optional();

// An engineer raises a request: what's inspected (+ optional area/notes/date) and
// which QA/QC engineer should inspect it.
export const requestInspectionSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().trim().min(1, "Name what's being inspected").max(160),
  area: optionalText(160),
  description: optionalText(2000),
  inspectorId: z.string().uuid("Pick a QA/QC engineer"),
  scheduledFor: optionalDate,
});
export type RequestInspectionInput = z.infer<typeof requestInspectionSchema>;

// One checklist line the QA/QC engineer records on an attempt. `fileIds` are photos
// already uploaded against the inspection (presignInspectionPhotoAction) that get
// re-homed onto this item's result row when the attempt is saved.
const itemResultInputSchema = z.object({
  label: z.string().trim().min(1, "Item label required").max(300),
  result: z.enum(INSPECTION_ITEM_RESULTS),
  remarks: optionalText(2000),
  fileIds: z.array(z.string().uuid()).default([]),
});

// The QA/QC engineer records an outcome — the FIRST inspection OR a re-inspection
// (both append an attempt). They pick a preset checklist (optional — `checklistId`
// empty = free-form), mark each item, and set the overall PASSED/FAILED themselves.
// Remarks are required on a FAIL so the requester knows what to fix.
export const recordInspectionSchema = z
  .object({
    id: z.string().uuid(),
    outcome: z.enum(["PASSED", "FAILED"]),
    remarks: optionalText(2000),
    checklistId: optionalUuid,
    items: z.array(itemResultInputSchema).default([]),
  })
  .refine((v) => v.outcome !== "FAILED" || Boolean(v.remarks?.trim()), {
    message: "Add remarks explaining the failure",
    path: ["remarks"],
  });
export type RecordInspectionInput = z.infer<typeof recordInspectionSchema>;

export const inspectionIdSchema = z.object({ id: z.string().uuid() });
export const inspectionRefSchema = z.object({ inspectionId: z.string().uuid() });

// Upload-on-pick of an inspection photo (before its item-result row exists). The
// key is anchored to the INSPECTION; the record action re-homes the attachment to
// the specific item-result row.
export const presignInspectionPhotoSchema = z.object({
  inspectionId: z.string().uuid(),
  filename: z.string().trim().min(1).max(255),
  mime: z.string().trim().min(1).max(120),
  size: z.number().int().positive(),
});

// View a recorded item-result photo (short-lived presigned GET), scoped to the
// inspection + result for defense in depth.
export const inspectionPhotoUrlSchema = z.object({
  inspectionId: z.string().uuid(),
  resultId: z.string().uuid(),
  attachmentId: z.string().uuid(),
});

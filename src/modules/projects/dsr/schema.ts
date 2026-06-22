import { z } from "zod";

import { TRADE_CODES, UNIT_CODES } from "@/lib/lookups";
import { DSR_ISSUE_SEVERITIES } from "@/lib/statuses";
import { entityDocumentSchemas } from "@/modules/shared/contact-schema";

const optionalText = (max: number) =>
  z.union([z.literal(""), z.string().trim().max(max)]).optional();
const optionalUuid = z.union([z.literal(""), z.string().uuid()]).optional();
const optionalCode = <T extends [string, ...string[]]>(codes: T) =>
  z.union([z.literal(""), z.enum(codes)]).optional();
// numeric(14,3): up to 11 integer digits + 3 decimals.
const qty = z.coerce.number().min(0).max(99_999_999_999);
const optionalQty = z
  .union([z.literal(""), z.coerce.number().min(0).max(99_999_999_999)])
  .optional();

// ── DSR child line-items (the form submits the full set per section) ──────────
const manpowerRow = z.object({
  employeeId: optionalUuid,
  tradeCode: optionalCode(TRADE_CODES),
  headcount: z.coerce.number().int().min(1).max(100_000).default(1),
  hours: optionalQty,
});

const equipmentRow = z.object({
  name: z.string().trim().min(1, "Name the equipment").max(160),
  quantity: qty,
  hours: optionalQty,
  remarks: optionalText(300),
});

const materialRow = z
  .object({
    itemId: optionalUuid, // reserved for the Stage-3 inventory link
    description: optionalText(300),
    quantity: qty,
    unitCode: optionalCode(UNIT_CODES),
  })
  .refine((r) => !!(r.description && r.description.trim()) || !!r.itemId, {
    message: "Describe the material",
    path: ["description"],
  });

const issueRow = z.object({
  description: z.string().trim().min(1, "Describe the issue").max(1000),
  severity: z.enum(DSR_ISSUE_SEVERITIES).default("LOW"),
  resolved: z.boolean().default(false),
});

export const resolveTodayDsrSchema = z.object({ projectId: z.string().uuid() });
export const dsrIdSchema = z.object({ id: z.string().uuid() });

// Autosave / save the working DRAFT: header fields + the full child sets, which
// replace the stored rows (the form owns each section as a whole).
export const saveDsrDraftSchema = z.object({
  id: z.string().uuid(),
  weather: optionalText(120),
  workAccomplished: optionalText(5000),
  nextDayPlan: optionalText(5000),
  progressNote: optionalText(2000),
  manpower: z.array(manpowerRow).max(100).default([]),
  equipment: z.array(equipmentRow).max(100).default([]),
  materials: z.array(materialRow).max(200).default([]),
  issues: z.array(issueRow).max(100).default([]),
});

export type SaveDsrDraftInput = z.infer<typeof saveDsrDraftSchema>;
export type DsrManpowerInput = z.infer<typeof manpowerRow>;
export type DsrEquipmentInput = z.infer<typeof equipmentRow>;
export type DsrMaterialInput = z.infer<typeof materialRow>;
export type DsrIssueInput = z.infer<typeof issueRow>;

// ── DSR photos (file pipeline, scoped to the report; caption → attachment label) ─
const dsrDocs = entityDocumentSchemas("dsrId");
export const presignDsrPhotoSchema = dsrDocs.presign;
export const confirmDsrPhotoSchema = dsrDocs.confirm;
export const dsrPhotoIdSchema = dsrDocs.docId;

import { z } from "zod";

import { blockedReasonOk } from "./domain";

const name = z.string().trim().min(1, "Name is required").max(160, "Name is too long");
const optionalDate = z
  .union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date")])
  .optional();
const optionalText = (max: number) =>
  z.union([z.literal(""), z.string().trim().max(max)]).optional();
// Better Auth user ids are TEXT (not uuid).
const optionalUserId = z.union([z.literal(""), z.string().trim().min(1)]).optional();
const progressPct = z.coerce.number().min(0, "0–100").max(100, "0–100");

// ── Phases ──────────────────────────────────────────────────────────────────
const phaseObject = z.object({
  name,
  sequence: z.coerce.number().int().min(0).default(0),
  startDate: optionalDate,
  targetEndDate: optionalDate,
  remarks: optionalText(2000),
});

export const createPhaseSchema = phaseObject.extend({ projectId: z.string().uuid() });
export const updatePhaseSchema = phaseObject.extend({ id: z.string().uuid() });
export const phaseIdSchema = z.object({ id: z.string().uuid() });

// ── Tasks ───────────────────────────────────────────────────────────────────
const taskObject = z.object({
  phaseId: z.string().uuid(),
  name,
  assigneeId: optionalUserId,
  startDate: optionalDate,
  dueDate: optionalDate,
  progressPct: progressPct.default(0),
  isBlocked: z.boolean().default(false),
  blockedReason: optionalText(500),
  remarks: optionalText(2000),
});

const blockedRule = {
  message: "Add a reason when a task is blocked",
  path: ["blockedReason"],
};

export const createTaskSchema = taskObject.refine(blockedReasonOk, blockedRule);
export const updateTaskSchema = taskObject
  .extend({ id: z.string().uuid() })
  .refine(blockedReasonOk, blockedRule);
// The narrower assignee quick-path: progress only (docs/17 §10.14).
export const updateTaskProgressSchema = z.object({ id: z.string().uuid(), progressPct });
export const taskIdSchema = z.object({ id: z.string().uuid() });

export type CreatePhaseInput = z.infer<typeof createPhaseSchema>;
export type UpdatePhaseInput = z.infer<typeof updatePhaseSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type CreatePhaseFormValues = z.input<typeof createPhaseSchema>;
export type CreateTaskFormValues = z.input<typeof createTaskSchema>;

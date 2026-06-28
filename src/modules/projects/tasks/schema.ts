import { z } from "zod";

import { TASK_STATUSES } from "@/lib/statuses";

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
const weightPct = z.coerce.number().min(0, "0–100").max(100, "0–100");

// Soft date-ordering: only fires when BOTH ends of a pair are real dates ("" or
// undefined short-circuits to OK). YYYY-MM-DD strings compare correctly with `>=`.
// We don't police target-vs-actual — real schedules slip.
const orderedDates = (start?: string, end?: string) => !start || !end || end >= start;

const dateOrderRefine = (
  v: {
    targetStartDate?: string;
    targetEndDate?: string;
    actualStartDate?: string;
    actualEndDate?: string;
  },
  ctx: z.RefinementCtx,
) => {
  if (!orderedDates(v.targetStartDate, v.targetEndDate)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["targetEndDate"],
      message: "Target end can't be before target start",
    });
  }
  if (!orderedDates(v.actualStartDate, v.actualEndDate)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["actualEndDate"],
      message: "Actual end can't be before actual start",
    });
  }
};

// ── Phases ──────────────────────────────────────────────────────────────────
const phaseObject = z.object({
  name,
  sequence: z.coerce.number().int().min(0).default(0),
  targetStartDate: optionalDate,
  targetEndDate: optionalDate,
  actualStartDate: optionalDate,
  actualEndDate: optionalDate,
  remarks: optionalText(2000),
});

export const createPhaseSchema = phaseObject
  .extend({ projectId: z.string().uuid() })
  .superRefine(dateOrderRefine);
export const updatePhaseSchema = phaseObject
  .extend({ id: z.string().uuid() })
  .superRefine(dateOrderRefine);
export const phaseIdSchema = z.object({ id: z.string().uuid() });

// ── Tasks ───────────────────────────────────────────────────────────────────
const taskObject = z.object({
  phaseId: z.string().uuid(),
  name,
  assigneeId: optionalUserId,
  targetStartDate: optionalDate,
  targetEndDate: optionalDate,
  actualStartDate: optionalDate,
  actualEndDate: optionalDate,
  progressPct: progressPct.default(0),
  weightPct: weightPct.default(0),
  isBlocked: z.boolean().default(false),
  blockedReason: optionalText(500),
  remarks: optionalText(2000),
});

const blockedRule = {
  message: "Add a reason when a task is blocked",
  path: ["blockedReason"],
};

export const createTaskSchema = taskObject
  .refine(blockedReasonOk, blockedRule)
  .superRefine(dateOrderRefine);
export const updateTaskSchema = taskObject
  .extend({ id: z.string().uuid() })
  .refine(blockedReasonOk, blockedRule)
  .superRefine(dateOrderRefine);
// The narrower assignee quick-path: set status (docs/17 §10.14). Blocked keeps the
// task's current progress and needs a reason; the other three map to 0/50/100
// server-side. This is what the inline status pill calls.
export const updateTaskStatusSchema = z
  .object({
    id: z.string().uuid(),
    status: z.enum(TASK_STATUSES),
    blockedReason: optionalText(500),
    // The status pill prompts for these on transition (→In progress / →Done); each
    // defaults to today client-side but is editable. Persisted only for that status.
    actualStartDate: optionalDate,
    actualEndDate: optionalDate,
  })
  .refine((v) => v.status !== "BLOCKED" || Boolean(v.blockedReason?.trim()), {
    message: "Add a reason when blocking a task",
    path: ["blockedReason"],
  });
export const taskIdSchema = z.object({ id: z.string().uuid() });

// Bulk "edit all tasks in a phase". Each row is the desired final state: a row with
// an `id` updates that task, a row without one is created, and any existing task not
// represented is soft-deleted. Allocation, status, and the target schedule are editable
// here; actual dates and the blocked flag stay in the single-task dialog (they hang off
// status transitions).
const bulkTaskRow = z
  .object({
    id: z.string().uuid().optional(),
    name,
    assigneeId: optionalUserId,
    targetStartDate: optionalDate,
    targetEndDate: optionalDate,
    weightPct: weightPct.default(0),
    progressPct: progressPct.default(0),
  })
  .superRefine(dateOrderRefine);

export const bulkUpdateTasksSchema = z.object({
  phaseId: z.string().uuid(),
  rows: z.array(bulkTaskRow).max(200),
});

export type BulkTaskRowInput = z.infer<typeof bulkTaskRow>;
export type BulkTaskRowValues = z.input<typeof bulkTaskRow>;

export type CreatePhaseInput = z.infer<typeof createPhaseSchema>;
export type UpdatePhaseInput = z.infer<typeof updatePhaseSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;
export type CreatePhaseFormValues = z.input<typeof createPhaseSchema>;
export type CreateTaskFormValues = z.input<typeof createTaskSchema>;

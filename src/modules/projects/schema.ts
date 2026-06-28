import { z } from "zod";

import { PROJECT_STATUSES } from "@/lib/statuses";
import { entityDocumentSchemas, entityName, optionalText } from "@/modules/shared/contact-schema";

import { projectTemplatePayloadSchema } from "./templates/schema";

// Better Auth user ids are TEXT (not uuid) — use a non-empty string, never .uuid().
const userIdField = z.string().trim().min(1);
const optionalUserId = z.union([z.literal(""), userIdField]).optional();
const optionalDate = z
  .union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date")])
  .optional();
// Up to 12 integer digits + 2 decimals — matches DECIMAL(14,2).
const optionalAmount = z
  .union([z.literal(""), z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, "Enter a valid amount")])
  .optional();

export const createProjectSchema = z.object({
  name: entityName,
  clientId: z.string().uuid("Select a client"),
  location: optionalText(200),
  contractAmount: optionalAmount,
  startDate: optionalDate,
  targetEndDate: optionalDate,
  scopeOfWork: optionalText(2000),
  defectsLiabilityUntil: optionalDate,
  // The team: a lead (optional — can be assigned later) + member engineers. Both
  // become project_members rows (LEAD / MEMBER); leadEngineerId also stamps the
  // project's display label.
  leadEngineerId: optionalUserId,
  memberIds: z.array(userIdField).default([]),
  // Optional: seed the project's phases/tasks from a template. `startDate` anchors
  // the calendar-day chain (the action requires it when a template is chosen). The
  // per-phase durations carry the user's review-step adjustments.
  template: projectTemplatePayloadSchema.optional(),
});

export const updateProjectSchema = createProjectSchema.extend({ id: z.string().uuid() });
export const projectIdSchema = z.object({ id: z.string().uuid() });

export const changeProjectStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(PROJECT_STATUSES),
  // Required by the action when status is COMPLETED; defaults to today otherwise.
  actualEndDate: optionalDate,
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ChangeProjectStatusInput = z.infer<typeof changeProjectStatusSchema>;
// Form-side (resolver INPUT) type — memberIds is optional pre-default.
export type CreateProjectFormValues = z.input<typeof createProjectSchema>;

// ── Project documents (file pipeline) + notes — projectId scopes every op ───────
const projectDocs = entityDocumentSchemas("projectId");
export const presignProjectDocumentSchema = projectDocs.presign;
export const confirmProjectDocumentSchema = projectDocs.confirm;
export const projectDocumentIdSchema = projectDocs.docId;
export const addProjectNoteSchema = projectDocs.addNote;
export const projectNoteIdSchema = projectDocs.noteId;

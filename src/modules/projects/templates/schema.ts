import { z } from "zod";

import { entityName, optionalText } from "@/modules/shared/contact-schema";

// Pure Zod — shared by the guarded actions and unit tests (no server imports).

const templateName = z.string().trim().min(1, "Name this item").max(160);
const durationDays = z.coerce
  .number({ message: "Enter a number of days" })
  .int("Whole days only")
  .min(1, "At least 1 day")
  .max(3650, "Too long");
const weightPct = z.coerce.number().min(0).max(100).default(0);

const templateTaskSchema = z.object({
  name: templateName,
  weightPct,
});

const templatePhaseSchema = z.object({
  name: templateName,
  durationDays,
  tasks: z.array(templateTaskSchema).default([]),
});

// The editor submits the whole tree (template meta + ordered phases, each with its
// ordered tasks); the action writes it as a fresh snapshot.
export const createTemplateSchema = z.object({
  name: entityName,
  description: optionalText(2000),
  isActive: z.boolean().default(true),
  phases: z.array(templatePhaseSchema).min(1, "Add at least one phase"),
});

export const updateTemplateSchema = createTemplateSchema.extend({ id: z.string().uuid() });
export const templateIdSchema = z.object({ id: z.string().uuid() });

// Instantiation payload (the review step). `phases` carries the USER-ADJUSTED
// per-phase durations keyed by the template phase id; any phase not listed falls
// back to its stored default. `startDate` anchors the calendar-day chain.
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a start date");
// One task in a phase's review-step list — template-seeded or new. The client sends
// the FULL edited list per phase (the template's tasks aren't re-read server-side),
// so renaming, reweighting, or removing a template task just works. Weight defaults
// 0 (unallocated, like any untouched task).
const phaseTaskInputSchema = z.object({ name: templateName, weightPct });
export const templatePhaseDurationSchema = z.object({
  templatePhaseId: z.string().uuid(),
  durationDays,
  tasks: z.array(phaseTaskInputSchema).default([]),
});
export type PhaseTaskInput = z.infer<typeof phaseTaskInputSchema>;
export const applyTemplateSchema = z.object({
  projectId: z.string().uuid(),
  templateId: z.string().uuid(),
  startDate: isoDate,
  phases: z.array(templatePhaseDurationSchema).default([]),
});

// Embedded in createProjectSchema when a project is created "from a template".
export const projectTemplatePayloadSchema = z.object({
  templateId: z.string().uuid(),
  phases: z.array(templatePhaseDurationSchema).default([]),
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type ApplyTemplateInput = z.infer<typeof applyTemplateSchema>;
export type ProjectTemplatePayload = z.infer<typeof projectTemplatePayloadSchema>;
// Form-side (resolver INPUT) types — pre-default/coercion.
export type TemplateFormValues = z.input<typeof createTemplateSchema>;

import { z } from "zod";

import { entityName, optionalText } from "@/modules/shared/contact-schema";

// Pure Zod — shared by the guarded actions and unit tests (no server imports).

const itemLabel = z.string().trim().min(1, "Name this item").max(300);

const checklistItemSchema = z.object({
  label: itemLabel,
  guidance: optionalText(500),
});

// The editor submits the whole checklist (meta + ordered items); the action writes
// it as a fresh snapshot.
export const createChecklistSchema = z.object({
  name: entityName,
  category: optionalText(80),
  description: optionalText(2000),
  isActive: z.boolean().default(true),
  items: z.array(checklistItemSchema).min(1, "Add at least one item"),
});

export const updateChecklistSchema = createChecklistSchema.extend({ id: z.string().uuid() });
export const checklistIdSchema = z.object({ id: z.string().uuid() });

export type CreateChecklistInput = z.infer<typeof createChecklistSchema>;
export type UpdateChecklistInput = z.infer<typeof updateChecklistSchema>;
export type ChecklistFormValues = z.input<typeof createChecklistSchema>;

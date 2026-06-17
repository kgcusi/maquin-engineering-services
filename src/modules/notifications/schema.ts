import { z } from "zod";

// Pure Zod — shared by the guarded actions and unit tests (no server imports).

export const markNotificationReadSchema = z.object({
  id: z.string().uuid(),
});
export type MarkNotificationReadInput = z.infer<typeof markNotificationReadSchema>;

// No input — the actor is taken from the session in the action guard.
export const emptySchema = z.object({});

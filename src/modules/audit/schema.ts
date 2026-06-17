import { z } from "zod";

// Parses raw `searchParams` into a typed, sanitised audit-log filter. Pure — NO
// server imports — so it is safe to unit-test and to share. Every field has a
// fallback, so `.parse()` never throws on hostile/garbage query strings: unknown
// or malformed values simply drop to "no filter" (or page 1).

// A free-text filter key: trimmed, non-empty, else dropped.
const textFilter = z.string().trim().min(1).optional().catch(undefined);

// A `YYYY-MM-DD` date from an <input type="date">. Must be a real calendar date;
// anything else (wrong format, 2026-13-45, …) drops to undefined.
const dateFilter = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => !Number.isNaN(new Date(v).getTime()), "Invalid date")
  .optional()
  .catch(undefined);

export const auditFilterSchema = z.object({
  actorId: textFilter,
  action: textFilter,
  entityType: textFilter,
  from: dateFilter,
  to: dateFilter,
  page: z.coerce.number().int().min(1).catch(1),
});

export type AuditFilterValues = z.infer<typeof auditFilterSchema>;

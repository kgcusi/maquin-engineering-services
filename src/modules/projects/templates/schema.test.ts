import { describe, expect, it } from "vitest";

import { applyTemplateSchema, projectTemplatePayloadSchema } from "./schema";

const UUID = "00000000-0000-0000-0000-000000000000";

describe("template instantiation payload — phase tasks", () => {
  it("defaults tasks to [] when a phase omits them", () => {
    const r = applyTemplateSchema.safeParse({
      projectId: UUID,
      templateId: UUID,
      startDate: "2026-07-01",
      phases: [{ templatePhaseId: UUID, durationDays: 7 }],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.phases[0].tasks).toEqual([]);
  });

  it("accepts a phase's edited task list and defaults a missing weight to 0", () => {
    const r = projectTemplatePayloadSchema.safeParse({
      templateId: UUID,
      phases: [
        {
          templatePhaseId: UUID,
          durationDays: 9,
          tasks: [{ name: "Permit follow-up" }, { name: "Client walkthrough", weightPct: 40 }],
        },
      ],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.phases[0].tasks).toHaveLength(2);
      expect(r.data.phases[0].tasks[0].weightPct).toBe(0);
      expect(r.data.phases[0].tasks[1].weightPct).toBe(40);
    }
  });

  it("rejects a blank-name task (client filters blanks before sending)", () => {
    const r = applyTemplateSchema.safeParse({
      projectId: UUID,
      templateId: UUID,
      startDate: "2026-07-01",
      phases: [{ templatePhaseId: UUID, durationDays: 7, tasks: [{ name: "" }] }],
    });
    expect(r.success).toBe(false);
  });
});

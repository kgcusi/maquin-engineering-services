"use server";

import { and, eq, isNull } from "drizzle-orm";

import type { Database } from "@/db/client";
import { phases } from "@/db/schema/phases";
import {
  projectTemplatePhases,
  projectTemplateTasks,
  projectTemplates,
} from "@/db/schema/project-templates";
import { projects } from "@/db/schema/projects";
import { orNull } from "@/lib/action-helpers";
import { audit } from "@/lib/audit";
import { cacheTags, revalidate } from "@/lib/events";
import { ActionError, action, actionNoTx, assertProjectAccess } from "@/lib/rbac";

import { TEMPLATE_ENTITY } from "./domain";
import {
  applyTemplateSchema,
  createTemplateSchema,
  templateIdSchema,
  updateTemplateSchema,
} from "./schema";
import { instantiateTemplate } from "./service";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
const roleOf = (u: { role?: string | null }) => u.role ?? null;

type PhaseInput = {
  name: string;
  durationDays: number;
  tasks: { name: string; weightPct: number }[];
};

// (Re)write a template's phase/task tree. Sequence = array index, so the editor's
// order is authoritative. Tasks cascade-delete with their phase, so callers replace
// the whole tree by deleting phases first.
async function writeTree(tx: Tx, templateId: string, phasesInput: PhaseInput[]): Promise<void> {
  for (let i = 0; i < phasesInput.length; i++) {
    const p = phasesInput[i];
    const [ph] = await tx
      .insert(projectTemplatePhases)
      .values({ templateId, name: p.name, sequence: i, durationDays: p.durationDays })
      .returning({ id: projectTemplatePhases.id });
    if (p.tasks.length) {
      await tx.insert(projectTemplateTasks).values(
        p.tasks.map((t, j) => ({
          templatePhaseId: ph.id,
          name: t.name,
          sequence: j,
          weightPct: t.weightPct,
        })),
      );
    }
  }
}

// actionNoTx + explicit tx so the cache `revalidate` runs AFTER commit (mirrors
// updateSettingsAction) — invalidating mid-transaction could re-cache a stale read.
export const createTemplateAction = actionNoTx(
  "template.manage",
  createTemplateSchema,
  async (input, { user: actor, db }) => {
    const id = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(projectTemplates)
        .values({
          name: input.name,
          description: orNull(input.description),
          isActive: input.isActive,
          createdBy: actor.id,
        })
        .returning({ id: projectTemplates.id });
      await writeTree(tx, created.id, input.phases);
      await audit(tx, {
        actorId: actor.id,
        action: "template.created",
        entityType: TEMPLATE_ENTITY,
        entityId: created.id,
        summary: `Created project template — ${input.name}`,
        diff: { phases: input.phases.length },
      });
      return created.id;
    });
    revalidate(cacheTags.templates);
    return { id };
  },
);

export const updateTemplateAction = actionNoTx(
  "template.manage",
  updateTemplateSchema,
  async (input, { user: actor, db }) => {
    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: projectTemplates.id })
        .from(projectTemplates)
        .where(and(eq(projectTemplates.id, input.id), isNull(projectTemplates.deletedAt)))
        .limit(1);
      if (!existing) throw new ActionError("Template not found.");

      await tx
        .update(projectTemplates)
        .set({
          name: input.name,
          description: orNull(input.description),
          isActive: input.isActive,
          updatedAt: new Date(),
        })
        .where(eq(projectTemplates.id, input.id));
      // Replace the whole tree (tasks cascade with their phases).
      await tx.delete(projectTemplatePhases).where(eq(projectTemplatePhases.templateId, input.id));
      await writeTree(tx, input.id, input.phases);

      await audit(tx, {
        actorId: actor.id,
        action: "template.updated",
        entityType: TEMPLATE_ENTITY,
        entityId: input.id,
        summary: `Updated project template — ${input.name}`,
        diff: { phases: input.phases.length },
      });
    });
    revalidate(cacheTags.templates);
    return { id: input.id };
  },
);

export const deleteTemplateAction = actionNoTx(
  "template.manage",
  templateIdSchema,
  async (input, { user: actor, db }) => {
    const changed = await db.transaction(async (tx) => {
      const [target] = await tx
        .select({ name: projectTemplates.name, deletedAt: projectTemplates.deletedAt })
        .from(projectTemplates)
        .where(eq(projectTemplates.id, input.id))
        .limit(1);
      if (!target || target.deletedAt) return false;
      await tx
        .update(projectTemplates)
        .set({ deletedAt: new Date() })
        .where(eq(projectTemplates.id, input.id));
      await audit(tx, {
        actorId: actor.id,
        action: "template.deleted",
        entityType: TEMPLATE_ENTITY,
        entityId: input.id,
        summary: `Deleted project template — ${target.name}`,
      });
      return true;
    });
    if (changed) revalidate(cacheTags.templates);
    return { ok: true };
  },
);

// Apply a template to an EXISTING project — only when it has no phases yet (never
// clobber existing work). Shares instantiateTemplate with the create-time path.
export const applyTemplateToProjectAction = action(
  "project.update",
  applyTemplateSchema,
  async (input, { user: actor, tx }) => {
    await assertProjectAccess(tx, {
      userId: actor.id,
      role: roleOf(actor),
      projectId: input.projectId,
    });
    const [project] = await tx
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(and(eq(projects.id, input.projectId), isNull(projects.deletedAt)))
      .limit(1);
    if (!project) throw new ActionError("Project not found.");

    const [existingPhase] = await tx
      .select({ id: phases.id })
      .from(phases)
      .where(and(eq(phases.projectId, input.projectId), isNull(phases.deletedAt)))
      .limit(1);
    if (existingPhase) {
      throw new ActionError(
        "This project already has phases — apply a template only to an empty project.",
      );
    }

    const overrides = new Map(input.phases.map((p) => [p.templatePhaseId, p.durationDays]));
    const tasksByPhase = new Map(input.phases.map((p) => [p.templatePhaseId, p.tasks]));
    const result = await instantiateTemplate(tx, {
      projectId: input.projectId,
      templateId: input.templateId,
      startDate: input.startDate,
      durationOverrides: overrides,
      tasksByPhase,
    });

    await audit(tx, {
      actorId: actor.id,
      action: "project.template_applied",
      entityType: "project",
      entityId: input.projectId,
      summary: `Applied a template to ${project.name} (${result.phaseCount} phases, ${result.taskCount} tasks)`,
    });
    return result;
  },
);

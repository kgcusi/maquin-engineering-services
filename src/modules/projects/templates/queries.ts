import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { db } from "@/db/client";
import {
  projectTemplatePhases,
  projectTemplateTasks,
  projectTemplates,
} from "@/db/schema/project-templates";

export type TemplateTaskNode = { name: string; weightPct: number };
export type TemplatePhaseNode = {
  id: string;
  name: string;
  sequence: number;
  durationDays: number;
  tasks: TemplateTaskNode[];
};
export type TemplateTree = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  phases: TemplatePhaseNode[];
};

// Assemble a flat phase list + task list into nested trees, keyed by template id.
function buildTrees(
  templates: { id: string; name: string; description: string | null; isActive: boolean }[],
  phaseRows: {
    id: string;
    templateId: string;
    name: string;
    sequence: number;
    durationDays: number;
  }[],
  taskRows: { templatePhaseId: string; name: string; weightPct: number }[],
): TemplateTree[] {
  const tasksByPhase = new Map<string, TemplateTaskNode[]>();
  for (const t of taskRows) {
    const list = tasksByPhase.get(t.templatePhaseId) ?? [];
    list.push({ name: t.name, weightPct: t.weightPct });
    tasksByPhase.set(t.templatePhaseId, list);
  }
  const phasesByTemplate = new Map<string, TemplatePhaseNode[]>();
  for (const p of phaseRows) {
    const list = phasesByTemplate.get(p.templateId) ?? [];
    list.push({
      id: p.id,
      name: p.name,
      sequence: p.sequence,
      durationDays: p.durationDays,
      tasks: tasksByPhase.get(p.id) ?? [],
    });
    phasesByTemplate.set(p.templateId, list);
  }
  return templates.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    isActive: t.isActive,
    phases: phasesByTemplate.get(t.id) ?? [],
  }));
}

async function loadTrees(
  templateRows: { id: string; name: string; description: string | null; isActive: boolean }[],
): Promise<TemplateTree[]> {
  if (!templateRows.length) return [];
  const ids = templateRows.map((t) => t.id);
  const phaseRows = await db
    .select({
      id: projectTemplatePhases.id,
      templateId: projectTemplatePhases.templateId,
      name: projectTemplatePhases.name,
      sequence: projectTemplatePhases.sequence,
      durationDays: projectTemplatePhases.durationDays,
    })
    .from(projectTemplatePhases)
    .where(inArray(projectTemplatePhases.templateId, ids))
    .orderBy(asc(projectTemplatePhases.sequence));

  const phaseIds = phaseRows.map((p) => p.id);
  const taskRows = phaseIds.length
    ? await db
        .select({
          templatePhaseId: projectTemplateTasks.templatePhaseId,
          name: projectTemplateTasks.name,
          weightPct: projectTemplateTasks.weightPct,
        })
        .from(projectTemplateTasks)
        .where(inArray(projectTemplateTasks.templatePhaseId, phaseIds))
        .orderBy(asc(projectTemplateTasks.sequence))
    : [];

  return buildTrees(templateRows, phaseRows, taskRows);
}

/**
 * The "Start from template" picker source — full trees of every ACTIVE template.
 * Cached (firm-wide, slow-changing reference data, docs/16 §7); invalidated by the
 * template CRUD actions via `revalidate(cacheTags.templates)`. Reads only template
 * tables — never the session — so it's cache-safe.
 */
export async function getActiveTemplatesWithTree(): Promise<TemplateTree[]> {
  "use cache";
  cacheLife("max");
  cacheTag("templates");

  const templateRows = await db
    .select({
      id: projectTemplates.id,
      name: projectTemplates.name,
      description: projectTemplates.description,
      isActive: projectTemplates.isActive,
    })
    .from(projectTemplates)
    .where(and(isNull(projectTemplates.deletedAt), eq(projectTemplates.isActive, true)))
    .orderBy(asc(projectTemplates.name));

  return loadTrees(templateRows);
}

/**
 * Admin management list (Setup → Templates) — full trees of every non-deleted
 * template (active AND inactive). Dynamic. Templates are few and small, so loading
 * the whole tree here lets the list show counts and the editor open instantly off
 * the same data (no per-row round-trip). Phase/task counts derive from the tree.
 */
export async function listTemplatesForAdmin(): Promise<TemplateTree[]> {
  const templateRows = await db
    .select({
      id: projectTemplates.id,
      name: projectTemplates.name,
      description: projectTemplates.description,
      isActive: projectTemplates.isActive,
    })
    .from(projectTemplates)
    .where(isNull(projectTemplates.deletedAt))
    .orderBy(asc(projectTemplates.name));
  return loadTrees(templateRows);
}

/** Full tree for the editor — any non-deleted template (active or not). */
export async function getTemplateForAdmin(id: string): Promise<TemplateTree | null> {
  const [templateRow] = await db
    .select({
      id: projectTemplates.id,
      name: projectTemplates.name,
      description: projectTemplates.description,
      isActive: projectTemplates.isActive,
    })
    .from(projectTemplates)
    .where(and(eq(projectTemplates.id, id), isNull(projectTemplates.deletedAt)))
    .limit(1);
  if (!templateRow) return null;
  const [tree] = await loadTrees([templateRow]);
  return tree ?? null;
}

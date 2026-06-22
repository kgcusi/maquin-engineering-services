import { and, asc, count, desc, eq, isNull, or, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { user } from "@/db/schema/auth";
import { clients } from "@/db/schema/clients";
import { projectMembers } from "@/db/schema/project-members";
import { projects } from "@/db/schema/projects";
import { hasPermission, projectAccessWhere } from "@/lib/rbac";
import { ROLES } from "@/lib/roles";
import { listAttachments } from "@/modules/files/service";
import { listNotes } from "@/modules/notes/service";
import {
  offsetFor,
  PAGE_SIZE,
  PANEL_PAGE_SIZE,
  searchClause,
  type DirectoryListParams,
  type Paginated,
} from "@/modules/shared/list-params";

// The current user, as far as project scoping cares. Admins (project.view.all)
// see everything; everyone else is filtered to their project_members rows.
export type ProjectViewer = { id: string; role: string | null };

const ACTIVE_USER = or(isNull(user.isActive), eq(user.isActive, true));
// LEAD first, then MEMBER, then INSPECTOR — a stable, meaningful team order.
const MEMBER_ROLE_ORDER = sql`case ${projectMembers.roleOnProject} when 'LEAD' then 0 when 'MEMBER' then 1 else 2 end`;

export type ProjectListRow = {
  id: string;
  refCode: string;
  name: string;
  clientName: string | null;
  leadName: string | null;
  status: string;
  progressPct: number;
  targetEndDate: string | null;
  createdAt: Date;
};

// Scoped project list: non-deleted projects the viewer may see (admins → all;
// engineers → membership only), newest first, with a name/ref-code search.
export async function listProjects(
  viewer: ProjectViewer,
  params: DirectoryListParams,
): Promise<Paginated<ProjectListRow>> {
  const where = and(
    isNull(projects.deletedAt),
    projectAccessWhere(viewer.role, viewer.id),
    searchClause(params.q, [projects.name, projects.refCode]),
  );

  const [rows, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: projects.id,
        refCode: projects.refCode,
        name: projects.name,
        clientName: clients.name,
        leadName: user.name,
        status: projects.status,
        progressPct: projects.progressPct,
        targetEndDate: projects.targetEndDate,
        createdAt: projects.createdAt,
      })
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .leftJoin(user, eq(projects.leadEngineerId, user.id))
      .where(where)
      .orderBy(desc(projects.createdAt))
      .limit(PAGE_SIZE)
      .offset(offsetFor(params.page, PAGE_SIZE)),
    db.select({ value: count() }).from(projects).where(where),
  ]);

  return { rows, total, page: params.page, pageSize: PAGE_SIZE };
}

export type ProjectMemberRow = {
  userId: string;
  name: string;
  email: string;
  roleOnProject: string;
};

export async function listProjectMembers(projectId: string): Promise<ProjectMemberRow[]> {
  return db
    .select({
      userId: projectMembers.userId,
      name: user.name,
      email: user.email,
      roleOnProject: projectMembers.roleOnProject,
    })
    .from(projectMembers)
    .innerJoin(user, eq(projectMembers.userId, user.id))
    .where(eq(projectMembers.projectId, projectId))
    .orderBy(MEMBER_ROLE_ORDER, asc(user.name));
}

export type ProjectDetail = {
  id: string;
  refCode: string;
  name: string;
  clientId: string;
  clientName: string | null;
  location: string | null;
  contractAmount: string | null; // DECIMAL(14,2) as a plain string (no Money on the client)
  startDate: string | null;
  targetEndDate: string | null;
  actualEndDate: string | null;
  scopeOfWork: string | null;
  defectsLiabilityUntil: string | null;
  leadEngineerId: string | null;
  leadName: string | null;
  status: string;
  progressPct: number;
  progressIsManual: boolean;
  createdAt: Date;
  updatedAt: Date;
  members: ProjectMemberRow[];
};

// One project + its team, scoped to the viewer. Returns null when the project is
// missing OR the viewer isn't a member (and isn't an admin) — the page renders the
// same designed 404 either way, so a guessed id can't confirm a record exists.
export async function getProjectDetail(
  viewer: ProjectViewer,
  id: string,
): Promise<ProjectDetail | null> {
  const [row] = await db
    .select({
      id: projects.id,
      refCode: projects.refCode,
      name: projects.name,
      clientId: projects.clientId,
      clientName: clients.name,
      location: projects.location,
      contractAmount: projects.contractAmount,
      startDate: projects.startDate,
      targetEndDate: projects.targetEndDate,
      actualEndDate: projects.actualEndDate,
      scopeOfWork: projects.scopeOfWork,
      defectsLiabilityUntil: projects.defectsLiabilityUntil,
      leadEngineerId: projects.leadEngineerId,
      leadName: user.name,
      status: projects.status,
      progressPct: projects.progressPct,
      progressIsManual: projects.progressIsManual,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .leftJoin(clients, eq(projects.clientId, clients.id))
    .leftJoin(user, eq(projects.leadEngineerId, user.id))
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
    .limit(1);

  if (!row) return null;

  if (!hasPermission(viewer.role, "project.view.all")) {
    const [member] = await db
      .select({ id: projectMembers.id })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, id), eq(projectMembers.userId, viewer.id)))
      .limit(1);
    if (!member) return null;
  }

  const members = await listProjectMembers(id);
  return {
    ...row,
    contractAmount: row.contractAmount ? row.contractAmount.toDecimalString() : null,
    members,
  };
}

// ── Pickers ────────────────────────────────────────────────────────────────
export type Option = { id: string; name: string };

/** Active clients for the project form's client picker. */
export function listClientOptions(): Promise<Option[]> {
  return db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(and(isNull(clients.deletedAt), eq(clients.isActive, true)))
    .orderBy(asc(clients.name));
}

/** Active engineers for the team picker (lead + members). QA/QC engineers join a
 *  project only via an inspection request, never the team picker. */
export function listEngineerOptions(): Promise<Option[]> {
  return db
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(and(eq(user.role, ROLES.ENGINEER), isNull(user.deletedAt), ACTIVE_USER))
    .orderBy(asc(user.name));
}

// ── Detail-tab panels over the polymorphic tables (entity_type = "project") ─────
export const PROJECT_ENTITY = "project" as const;
export const getProjectDocuments = (projectId: string, page: number) =>
  listAttachments(db, PROJECT_ENTITY, projectId, page, PANEL_PAGE_SIZE);
export const getProjectNotes = (projectId: string, page: number) =>
  listNotes(db, PROJECT_ENTITY, projectId, page, PANEL_PAGE_SIZE);

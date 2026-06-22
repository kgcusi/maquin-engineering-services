import { and, asc, count, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/db/client";
import { user } from "@/db/schema/auth";
import {
  dailyReports,
  dsrEquipment,
  dsrIssues,
  dsrManpower,
  dsrMaterials,
} from "@/db/schema/daily-reports";
import { employees } from "@/db/schema/employees";
import { projectMembers } from "@/db/schema/project-members";
import { projects } from "@/db/schema/projects";
import { hasPermission } from "@/lib/rbac";
import { listAttachments } from "@/modules/files/service";
import {
  offsetFor,
  PAGE_SIZE,
  PANEL_PAGE_SIZE,
  type Paginated,
  type DirectoryListParams,
} from "@/modules/shared/list-params";

import type { ProjectViewer } from "../queries";

export const DSR_ENTITY = "daily_report" as const;

export type DsrListRow = {
  id: string;
  refCode: string;
  reportDate: string;
  status: string;
  submittedByName: string | null;
  submittedAt: Date | null;
};

export async function listProjectDsrs(
  projectId: string,
  params: DirectoryListParams,
): Promise<Paginated<DsrListRow>> {
  const where = and(eq(dailyReports.projectId, projectId), isNull(dailyReports.deletedAt));

  const [rows, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: dailyReports.id,
        refCode: dailyReports.refCode,
        reportDate: dailyReports.reportDate,
        status: dailyReports.status,
        submittedByName: user.name,
        submittedAt: dailyReports.submittedAt,
      })
      .from(dailyReports)
      .leftJoin(user, eq(dailyReports.submittedBy, user.id))
      .where(where)
      .orderBy(desc(dailyReports.reportDate))
      .limit(PAGE_SIZE)
      .offset(offsetFor(params.page, PAGE_SIZE)),
    db.select({ value: count() }).from(dailyReports).where(where),
  ]);

  return { rows, total, page: params.page, pageSize: PAGE_SIZE };
}

export type DsrManpowerRow = {
  employeeId: string | null;
  employeeName: string | null;
  tradeCode: string | null;
  headcount: number;
  hours: number | null;
};
export type DsrEquipmentRow = {
  name: string;
  quantity: number;
  hours: number | null;
  remarks: string | null;
};
export type DsrMaterialRow = {
  itemId: string | null;
  description: string | null;
  quantity: number;
  unitCode: string | null;
};
export type DsrIssueRow = { description: string; severity: string; resolved: boolean };

export type DsrEditor = {
  id: string;
  refCode: string;
  projectId: string;
  projectName: string | null;
  reportDate: string;
  weather: string | null;
  workAccomplished: string | null;
  nextDayPlan: string | null;
  progressNote: string | null;
  status: string;
  submittedBy: string | null;
  submittedByName: string | null;
  submittedAt: Date | null;
  createdBy: string | null;
  manpower: DsrManpowerRow[];
  equipment: DsrEquipmentRow[];
  materials: DsrMaterialRow[];
  issues: DsrIssueRow[];
};

// One DSR with all sections, scoped to the viewer. Null when missing OR the viewer
// can't access the parent project — the editor page renders the same 404 either way.
export async function getDsrEditor(viewer: ProjectViewer, id: string): Promise<DsrEditor | null> {
  const [row] = await db
    .select({
      id: dailyReports.id,
      refCode: dailyReports.refCode,
      projectId: dailyReports.projectId,
      projectName: projects.name,
      reportDate: dailyReports.reportDate,
      weather: dailyReports.weather,
      workAccomplished: dailyReports.workAccomplished,
      nextDayPlan: dailyReports.nextDayPlan,
      progressNote: dailyReports.progressNote,
      status: dailyReports.status,
      submittedBy: dailyReports.submittedBy,
      submittedByName: user.name,
      submittedAt: dailyReports.submittedAt,
      createdBy: dailyReports.createdBy,
    })
    .from(dailyReports)
    .leftJoin(projects, eq(dailyReports.projectId, projects.id))
    .leftJoin(user, eq(dailyReports.submittedBy, user.id))
    .where(and(eq(dailyReports.id, id), isNull(dailyReports.deletedAt)))
    .limit(1);

  if (!row) return null;

  if (!hasPermission(viewer.role, "project.view.all")) {
    const [member] = await db
      .select({ id: projectMembers.id })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, row.projectId), eq(projectMembers.userId, viewer.id)))
      .limit(1);
    if (!member) return null;
  }

  const [manpower, equipment, materials, issues] = await Promise.all([
    db
      .select({
        employeeId: dsrManpower.employeeId,
        employeeName: employees.fullName,
        tradeCode: dsrManpower.tradeCode,
        headcount: dsrManpower.headcount,
        hours: dsrManpower.hours,
      })
      .from(dsrManpower)
      .leftJoin(employees, eq(dsrManpower.employeeId, employees.id))
      .where(eq(dsrManpower.dailyReportId, id))
      .orderBy(asc(dsrManpower.createdAt)),
    db
      .select({
        name: dsrEquipment.name,
        quantity: dsrEquipment.quantity,
        hours: dsrEquipment.hours,
        remarks: dsrEquipment.remarks,
      })
      .from(dsrEquipment)
      .where(eq(dsrEquipment.dailyReportId, id))
      .orderBy(asc(dsrEquipment.createdAt)),
    db
      .select({
        itemId: dsrMaterials.itemId,
        description: dsrMaterials.description,
        quantity: dsrMaterials.quantity,
        unitCode: dsrMaterials.unitCode,
      })
      .from(dsrMaterials)
      .where(eq(dsrMaterials.dailyReportId, id))
      .orderBy(asc(dsrMaterials.createdAt)),
    db
      .select({
        description: dsrIssues.description,
        severity: dsrIssues.severity,
        resolved: dsrIssues.resolved,
      })
      .from(dsrIssues)
      .where(eq(dsrIssues.dailyReportId, id))
      .orderBy(asc(dsrIssues.createdAt)),
  ]);

  return { ...row, manpower, equipment, materials, issues };
}

export const getDsrPhotos = (dsrId: string, page: number) =>
  listAttachments(db, DSR_ENTITY, dsrId, page, PANEL_PAGE_SIZE);

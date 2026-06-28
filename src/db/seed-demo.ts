import "./load-env"; // MUST be first — loads .env.local before ./client reads process.env

import { and, eq, inArray, isNull, like } from "drizzle-orm";

import { nextRefCode } from "@/lib/refcodes";
import { Money } from "@/lib/money";

import { db } from "./client";
import { user } from "./schema/auth";
import { clients } from "./schema/clients";
import { employees } from "./schema/employees";
import { projects } from "./schema/projects";
import { projectMembers } from "./schema/project-members";
import { phases } from "./schema/phases";
import { tasks } from "./schema/tasks";
import {
  dailyReports,
  dsrEquipment,
  dsrIssues,
  dsrManpower,
  dsrMaterials,
} from "./schema/daily-reports";
import { inspections } from "./schema/inspections";
import { inspectionAttempts, inspectionItemResults } from "./schema/inspection-attempts";
import { inspectionChecklistItems, inspectionChecklists } from "./schema/inspection-checklists";
import {
  projectTemplatePhases,
  projectTemplateTasks,
  projectTemplates,
} from "./schema/project-templates";
import { notes } from "./schema/notes";
import { notifications } from "./schema/notifications";

// ─────────────────────────────────────────────────────────────────────────────
// Stage 2 DEMO seed — populates Projects, Phases/Tasks, Daily Site Reports,
// Inspections (+checklists), Project Templates, and a few in-app Notifications
// with realistic, visually-rich data so the new screens can be eyeballed.
//
// Run: `pnpm exec tsx src/db/seed-demo.ts`  (or `pnpm db:seed:demo`)
//
// Idempotent: clients / employees / templates / checklists are FOUND-OR-CREATED
// by name (never duplicated). The projects below and everything cascading off
// them (members, phases, tasks, DSRs, inspections, project notes) plus the demo
// notifications are WIPED and rebuilt on every run, so re-running gives a clean,
// consistent dataset. Pre-existing data the firm created by hand is left alone.
//
// Reference codes (PRJ/DSR/INS) are allocated through the real ref counter, so a
// re-run continues the sequence — codes are never reused, by design.
// ─────────────────────────────────────────────────────────────────────────────

const TODAY = "2026-06-23"; // matches the session's "today"; the demo is anchored here
const YEAR = 2026;

const round2 = (n: number) => Math.round(n * 100) / 100;

function addDays(base: string, n: number): string {
  const d = new Date(`${base}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const ago = (days: number) => addDays(TODAY, -days);
const at = (ymd: string, time = "09:00:00") => new Date(`${ymd}T${time}.000Z`);

// ── Mirror the app's roll-up so stored phase/project progress matches the read
//    path exactly (src/modules/projects/tasks/actions.ts PHASE_PROGRESS). ───────
type TaskDef = {
  name: string;
  weight: number; // weightPct (share of the phase, summed ≤ 100)
  progress: number; // progressPct (0–100)
  assignee?: string | null; // engineer email
  targetStart?: string;
  targetEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  blockedReason?: string;
  delayedFlag?: boolean; // also set the STORED nightly-job flag
  remarks?: string;
};

function phaseProgress(ts: TaskDef[]): number {
  if (!ts.length) return 0;
  const sumW = ts.reduce((s, t) => s + t.weight, 0);
  if (sumW <= 0) return round2(ts.reduce((s, t) => s + t.progress, 0) / ts.length);
  return round2(ts.reduce((s, t) => s + t.weight * t.progress, 0) / 100);
}

function projectProgress(phaseDefs: PhaseDef[]): number {
  const withTasks = phaseDefs.filter((p) => p.tasks.length > 0);
  if (!withTasks.length) return 0;
  return round2(withTasks.reduce((s, p) => s + phaseProgress(p.tasks), 0) / withTasks.length);
}

type PhaseDef = {
  name: string;
  targetStart?: string;
  targetEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  remarks?: string;
  tasks: TaskDef[];
};

type ManpowerDef = { employee?: string; trade: string; headcount: number; hours?: number };
type EquipmentDef = { name: string; quantity: number; hours?: number; remarks?: string };
type MaterialDef = { description: string; quantity: number; unit: string };
type IssueDef = { description: string; severity: "LOW" | "MEDIUM" | "HIGH"; resolved?: boolean };

type DsrDef = {
  daysAgo: number;
  status: "DRAFT" | "SUBMITTED";
  author: string; // email
  weather?: string;
  workAccomplished?: string;
  nextDayPlan?: string;
  progressNote?: string;
  manpower?: ManpowerDef[];
  equipment?: EquipmentDef[];
  materials?: MaterialDef[];
  issues?: IssueDef[];
};

type AttemptDef = {
  outcome: "PASSED" | "FAILED";
  daysAgo: number;
  remarks?: string;
  items: { label: string; result: "PASS" | "FAIL" | "NA"; remarks?: string }[];
};

type InspectionDef = {
  title: string;
  area?: string;
  description?: string;
  scheduledFor?: string;
  requestedBy: string; // email
  checklist?: string; // checklist name → checklistId
  attempts: AttemptDef[]; // empty ⇒ still REQUESTED
};

type ProjectDef = {
  name: string;
  client: string;
  status: "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
  lead: string; // email
  members: string[]; // emails (excl. lead)
  contract: string; // decimal string
  location: string;
  scope: string;
  startDate: string | null;
  targetEndDate: string | null;
  actualEndDate?: string;
  defectsLiabilityUntil?: string;
  phases: PhaseDef[];
  dsrs: DsrDef[];
  inspections: InspectionDef[];
  notes: string[];
};

// ── Reference data (found-or-created) ────────────────────────────────────────
const DEMO_CLIENTS: {
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
}[] = [
  {
    name: "Ayala Land, Inc.",
    contactPerson: "Maria Santos",
    phone: "+63 2 8908 3000",
    email: "projects@ayalaland.com.ph",
    address: "Tower One, Ayala Triangle, Makati City",
  },
  {
    name: "SM Prime Holdings, Inc.",
    contactPerson: "Jose Reyes",
    phone: "+63 2 8831 1000",
    email: "construction@smprime.com",
    address: "Mall of Asia Complex, Pasay City",
  },
  {
    name: "Department of Public Works and Highways",
    contactPerson: "Engr. Ricardo Cruz",
    phone: "+63 2 5304 3000",
    email: "ncr.projects@dpwh.gov.ph",
    address: "Bonifacio Drive, Port Area, Manila",
  },
  {
    name: "Robinsons Land Corporation",
    contactPerson: "Anna Lim",
    phone: "+63 2 8397 1888",
    email: "devt@robinsonsland.com",
    address: "Galleria Corporate Center, Ortigas, Pasig City",
  },
  {
    name: "Megaworld Corporation",
    contactPerson: "Paolo Tan",
    phone: "+63 2 8867 8826",
    email: "build@megaworldcorp.com",
    address: "Uptown Bonifacio, Taguig City",
  },
];

const DEMO_EMPLOYEES: {
  fullName: string;
  position: string;
  employmentType: string;
  rate: string;
  rateUnit?: string;
}[] = [
  { fullName: "Ramon dela Cruz", position: "Foreman", employmentType: "REGULAR", rate: "950.00" },
  {
    fullName: "Pedro Bautista",
    position: "Mason",
    employmentType: "PROJECT_BASED",
    rate: "720.00",
  },
  { fullName: "Juan Mendoza", position: "Mason", employmentType: "PROJECT_BASED", rate: "720.00" },
  {
    fullName: "Carlos Aquino",
    position: "Carpenter",
    employmentType: "PROJECT_BASED",
    rate: "760.00",
  },
  {
    fullName: "Miguel Torres",
    position: "Steelman",
    employmentType: "PROJECT_BASED",
    rate: "790.00",
  },
  {
    fullName: "Andres Villanueva",
    position: "Electrician",
    employmentType: "CONTRACTUAL",
    rate: "860.00",
  },
  {
    fullName: "Roberto Gonzales",
    position: "Plumber",
    employmentType: "CONTRACTUAL",
    rate: "830.00",
  },
  {
    fullName: "Eduardo Ramos",
    position: "Welder",
    employmentType: "PROJECT_BASED",
    rate: "810.00",
  },
  {
    fullName: "Antonio Castro",
    position: "Equipment Operator",
    employmentType: "REGULAR",
    rate: "1100.00",
  },
  {
    fullName: "Felipe Domingo",
    position: "Laborer",
    employmentType: "PROJECT_BASED",
    rate: "610.00",
  },
  {
    fullName: "Ricardo Navarro",
    position: "Safety Officer",
    employmentType: "REGULAR",
    rate: "28000.00",
    rateUnit: "MONTHLY",
  },
];

const DEMO_CHECKLISTS: {
  name: string;
  category: string;
  description: string;
  items: { label: string; guidance?: string }[];
}[] = [
  {
    name: "Concrete Pouring Inspection",
    category: "Concrete",
    description: "Pre-pour and during-pour checks for cast-in-place concrete.",
    items: [
      {
        label: "Formworks aligned, tight, and adequately braced",
        guidance: "No gaps, props plumb.",
      },
      { label: "Rebar size, spacing, and lap length per structural plan" },
      { label: "Concrete cover maintained with spacers/chairs" },
      { label: "Embedded items and sleeves in correct position" },
      { label: "Slump test within approved tolerance" },
      { label: "Adequate vibration / consolidation during pour" },
    ],
  },
  {
    name: "Electrical Rough-in Inspection",
    category: "Electrical",
    description: "Conduit and roughing-in verification before concealment.",
    items: [
      { label: "Conduit routing follows approved layout" },
      { label: "Junction and outlet boxes secured at correct height" },
      { label: "Wire/cable sizing matches the riser diagram" },
      { label: "Grounding and bonding continuous" },
      { label: "No damaged insulation or kinked conduit" },
    ],
  },
  {
    name: "Structural Rebar Inspection",
    category: "Structural",
    description: "Reinforcement check prior to formwork closure.",
    items: [
      { label: "Bar diameter matches the bar schedule" },
      { label: "Spacing and clear cover within tolerance" },
      { label: "Lap splice lengths and stagger correct" },
      { label: "Stirrup / tie spacing and hooks compliant" },
      { label: "Reinforcement clean — no loose rust, oil, or mud" },
    ],
  },
];

const DEMO_TEMPLATES: {
  name: string;
  description: string;
  phases: { name: string; durationDays: number; tasks: [string, number][] }[];
}[] = [
  {
    name: "Residential 3-Storey Building",
    description: "Standard skeleton for a small reinforced-concrete residential build.",
    phases: [
      {
        name: "Mobilization & Site Prep",
        durationDays: 5,
        tasks: [
          ["Site clearing & hauling", 40],
          ["Temporary facilities", 30],
          ["Survey & staking", 30],
        ],
      },
      {
        name: "Earthworks & Foundation",
        durationDays: 21,
        tasks: [
          ["Excavation", 25],
          ["Footing formworks", 25],
          ["Footing reinforcement", 25],
          ["Footing concrete pour", 25],
        ],
      },
      {
        name: "Structural Works",
        durationDays: 45,
        tasks: [
          ["Columns", 30],
          ["Beams", 25],
          ["Suspended slabs", 25],
          ["Staircase", 20],
        ],
      },
      {
        name: "Masonry & Architectural",
        durationDays: 40,
        tasks: [
          ["CHB laying", 35],
          ["Plastering", 35],
          ["Tile & finishes", 30],
        ],
      },
      {
        name: "MEPF Rough-in",
        durationDays: 30,
        tasks: [
          ["Electrical rough-in", 40],
          ["Plumbing rough-in", 35],
          ["Mechanical rough-in", 25],
        ],
      },
      {
        name: "Finishing & Turnover",
        durationDays: 20,
        tasks: [
          ["Painting", 40],
          ["Fixtures & fittings", 35],
          ["Punchlist & cleanup", 25],
        ],
      },
    ],
  },
  {
    name: "Road Concreting (PCCP)",
    description: "Portland-cement concrete pavement skeleton for a road package.",
    phases: [
      {
        name: "Survey & Staking",
        durationDays: 5,
        tasks: [
          ["Topographic survey", 50],
          ["Staking & layout", 50],
        ],
      },
      {
        name: "Subgrade Preparation",
        durationDays: 10,
        tasks: [
          ["Clearing & grubbing", 30],
          ["Embankment & fill", 40],
          ["Compaction", 30],
        ],
      },
      {
        name: "Base Course",
        durationDays: 12,
        tasks: [
          ["Aggregate base course", 60],
          ["Grading & compaction", 40],
        ],
      },
      {
        name: "PCCP Pouring",
        durationDays: 20,
        tasks: [
          ["Formworks", 30],
          ["Dowel & tie bars", 30],
          ["Concrete pouring", 40],
        ],
      },
      {
        name: "Curing & Joint Works",
        durationDays: 14,
        tasks: [
          ["Curing", 50],
          ["Saw-cutting joints", 25],
          ["Joint sealing", 25],
        ],
      },
      {
        name: "Cleanup & Turnover",
        durationDays: 5,
        tasks: [
          ["Shoulder works", 50],
          ["Final cleanup", 50],
        ],
      },
    ],
  },
];

// ── helpers bound after we resolve users/clients/employees ───────────────────
let ENG1 = ""; // primary engineer (lead/member)
let ENG2 = ""; // second engineer
let QA = ""; // QA/QC engineer (inspector)
let ADMIN = ""; // an admin recipient for notifications
const employeeIdByName = new Map<string, string>();
const checklistIdByName = new Map<string, string>();

async function resolveUsers(): Promise<void> {
  const rows = await db
    .select({ id: user.id, email: user.email, role: user.role })
    .from(user)
    .where(isNull(user.deletedAt));
  const engineers = rows.filter((r) => r.role === "ENGINEER");
  const qa = rows.find((r) => r.role === "QA_QC_ENGINEER");
  const admin = rows.find((r) => r.role === "ADMIN");

  if (engineers.length < 1)
    throw new Error("Need at least one ENGINEER user — run `pnpm db:seed` first.");
  ENG1 = engineers[0].email;
  ENG2 = (engineers[1] ?? engineers[0]).email;
  QA = qa?.email ?? "";
  ADMIN = admin?.email ?? engineers[0].email;
}

const userIdByEmail = new Map<string, string>();
async function loadUserIds(): Promise<void> {
  const rows = await db.select({ id: user.id, email: user.email }).from(user);
  for (const r of rows) userIdByEmail.set(r.email, r.id);
}
const uid = (email: string | null | undefined) =>
  email ? (userIdByEmail.get(email) ?? null) : null;

// ── Find-or-create reference rows ────────────────────────────────────────────
async function ensureClients(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const c of DEMO_CLIENTS) {
    const [existing] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.name, c.name))
      .limit(1);
    if (existing) {
      map.set(c.name, existing.id);
      continue;
    }
    const [created] = await db.insert(clients).values(c).returning({ id: clients.id });
    map.set(c.name, created.id);
  }
  console.log(`✓ clients ready (${map.size})`);
  return map;
}

async function ensureEmployees(): Promise<void> {
  for (const e of DEMO_EMPLOYEES) {
    const [existing] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(eq(employees.fullName, e.fullName))
      .limit(1);
    if (existing) {
      employeeIdByName.set(e.fullName, existing.id);
      continue;
    }
    const [created] = await db
      .insert(employees)
      .values({
        fullName: e.fullName,
        position: e.position,
        employmentType: e.employmentType,
        rate: Money.fromDecimal(e.rate),
        rateUnit: e.rateUnit ?? "DAILY",
      })
      .returning({ id: employees.id });
    employeeIdByName.set(e.fullName, created.id);
  }
  console.log(`✓ employees ready (${employeeIdByName.size})`);
}

async function ensureChecklists(): Promise<void> {
  for (const c of DEMO_CHECKLISTS) {
    const [existing] = await db
      .select({ id: inspectionChecklists.id })
      .from(inspectionChecklists)
      .where(and(eq(inspectionChecklists.name, c.name), isNull(inspectionChecklists.deletedAt)))
      .limit(1);
    if (existing) {
      checklistIdByName.set(c.name, existing.id);
      continue;
    }
    const [created] = await db
      .insert(inspectionChecklists)
      .values({
        name: c.name,
        category: c.category,
        description: c.description,
        createdBy: uid(ADMIN),
      })
      .returning({ id: inspectionChecklists.id });
    await db.insert(inspectionChecklistItems).values(
      c.items.map((it, i) => ({
        checklistId: created.id,
        label: it.label,
        guidance: it.guidance ?? null,
        sequence: i,
      })),
    );
    checklistIdByName.set(c.name, created.id);
  }
  console.log(`✓ inspection checklists ready (${checklistIdByName.size})`);
}

async function ensureTemplates(): Promise<void> {
  let created = 0;
  for (const t of DEMO_TEMPLATES) {
    const [existing] = await db
      .select({ id: projectTemplates.id })
      .from(projectTemplates)
      .where(and(eq(projectTemplates.name, t.name), isNull(projectTemplates.deletedAt)))
      .limit(1);
    if (existing) continue;
    const [tpl] = await db
      .insert(projectTemplates)
      .values({ name: t.name, description: t.description, createdBy: uid(ADMIN) })
      .returning({ id: projectTemplates.id });
    for (let i = 0; i < t.phases.length; i++) {
      const p = t.phases[i];
      const [tphase] = await db
        .insert(projectTemplatePhases)
        .values({ templateId: tpl.id, name: p.name, sequence: i, durationDays: p.durationDays })
        .returning({ id: projectTemplatePhases.id });
      await db.insert(projectTemplateTasks).values(
        p.tasks.map(([name, weight], j) => ({
          templatePhaseId: tphase.id,
          name,
          sequence: j,
          weightPct: weight,
        })),
      );
    }
    created++;
  }
  console.log(`✓ project templates ready (${created} created)`);
}

// ── Wipe previously-seeded demo projects + notifications (idempotency) ────────
const DEMO_NOTIF_PREFIX = "demo:";

async function wipeDemoProjects(names: string[]): Promise<void> {
  const existing = await db
    .select({ id: projects.id })
    .from(projects)
    .where(inArray(projects.name, names));
  const ids = existing.map((e) => e.id);
  if (ids.length) {
    // Project notes are polymorphic (no FK cascade) — clear them explicitly first.
    await db
      .delete(notes)
      .where(and(eq(notes.entityType, "project"), inArray(notes.entityId, ids)));
    // Deleting the project cascades: members, phases→tasks, daily_reports→children,
    // inspections→attempts→item_results.
    await db.delete(projects).where(inArray(projects.id, ids));
  }
  await db.delete(notifications).where(like(notifications.idempotencyKey, `${DEMO_NOTIF_PREFIX}%`));
  console.log(`✓ wiped ${ids.length} prior demo project(s) + demo notifications`);
}

// ── Build one project + its whole tree in a single transaction ───────────────
async function createProject(
  def: ProjectDef,
  clientMap: Map<string, string>,
): Promise<{ refCode: string; projectId: string }> {
  return db.transaction(async (tx) => {
    const refCode = await nextRefCode(tx, "PRJ", YEAR);
    const projProgress = projectProgress(def.phases);

    const [proj] = await tx
      .insert(projects)
      .values({
        refCode,
        name: def.name,
        clientId: clientMap.get(def.client)!,
        location: def.location,
        contractAmount: Money.fromDecimal(def.contract),
        startDate: def.startDate,
        targetEndDate: def.targetEndDate,
        actualEndDate: def.actualEndDate ?? null,
        scopeOfWork: def.scope,
        leadEngineerId: uid(def.lead),
        status: def.status,
        defectsLiabilityUntil: def.defectsLiabilityUntil ?? null,
        progressPct: projProgress,
        progressIsManual: false,
        createdBy: uid(ADMIN),
        createdAt: def.startDate ? at(def.startDate, "08:00:00") : at(TODAY, "08:00:00"),
      })
      .returning({ id: projects.id });
    const projectId = proj.id;

    // Team: LEAD + MEMBERs
    const memberRows = [
      { projectId, userId: uid(def.lead)!, roleOnProject: "LEAD" },
      ...def.members.map((m) => ({ projectId, userId: uid(m)!, roleOnProject: "MEMBER" })),
    ];
    await tx.insert(projectMembers).values(memberRows);

    // Phases + tasks
    for (let i = 0; i < def.phases.length; i++) {
      const p = def.phases[i];
      const [ph] = await tx
        .insert(phases)
        .values({
          projectId,
          name: p.name,
          sequence: i,
          targetStartDate: p.targetStart ?? null,
          targetEndDate: p.targetEnd ?? null,
          actualStartDate: p.actualStart ?? null,
          actualEndDate: p.actualEnd ?? null,
          progressPct: phaseProgress(p.tasks),
          remarks: p.remarks ?? null,
        })
        .returning({ id: phases.id });

      if (p.tasks.length) {
        await tx.insert(tasks).values(
          p.tasks.map((t) => {
            const blocked = !!t.blockedReason && t.progress < 100;
            return {
              phaseId: ph.id,
              name: t.name,
              assigneeId: uid(t.assignee),
              targetStartDate: t.targetStart ?? null,
              targetEndDate: t.targetEnd ?? null,
              actualStartDate: t.actualStart ?? null,
              actualEndDate: t.actualEnd ?? null,
              progressPct: t.progress,
              weightPct: t.weight,
              isBlocked: blocked,
              blockedReason: blocked ? t.blockedReason! : null,
              isDelayed: !!t.delayedFlag,
              delayedNotifiedAt: t.delayedFlag ? at(ago(2), "02:00:00") : null,
              remarks: t.remarks ?? null,
            };
          }),
        );
      }
    }

    // Daily Site Reports + child line-items
    for (const d of def.dsrs) {
      const reportDate = ago(d.daysAgo);
      const dref = await nextRefCode(tx, "DSR", YEAR);
      const [dsr] = await tx
        .insert(dailyReports)
        .values({
          refCode: dref,
          projectId,
          reportDate,
          weather: d.weather ?? null,
          workAccomplished: d.workAccomplished ?? null,
          nextDayPlan: d.nextDayPlan ?? null,
          progressNote: d.progressNote ?? null,
          status: d.status,
          submittedBy: d.status === "SUBMITTED" ? uid(d.author) : null,
          submittedAt: d.status === "SUBMITTED" ? at(reportDate, "17:30:00") : null,
          createdBy: uid(d.author),
          createdAt: at(reportDate, "08:00:00"),
          updatedAt: at(reportDate, d.status === "SUBMITTED" ? "17:30:00" : "12:00:00"),
        })
        .returning({ id: dailyReports.id });

      if (d.manpower?.length) {
        await tx.insert(dsrManpower).values(
          d.manpower.map((m) => ({
            dailyReportId: dsr.id,
            employeeId: m.employee ? (employeeIdByName.get(m.employee) ?? null) : null,
            tradeCode: m.trade,
            headcount: m.headcount,
            hours: m.hours ?? null,
          })),
        );
      }
      if (d.equipment?.length) {
        await tx.insert(dsrEquipment).values(
          d.equipment.map((e) => ({
            dailyReportId: dsr.id,
            name: e.name,
            quantity: e.quantity,
            hours: e.hours ?? null,
            remarks: e.remarks ?? null,
          })),
        );
      }
      if (d.materials?.length) {
        await tx.insert(dsrMaterials).values(
          d.materials.map((m) => ({
            dailyReportId: dsr.id,
            description: m.description,
            quantity: m.quantity,
            unitCode: m.unit,
          })),
        );
      }
      if (d.issues?.length) {
        await tx.insert(dsrIssues).values(
          d.issues.map((i) => ({
            dailyReportId: dsr.id,
            description: i.description,
            severity: i.severity,
            resolved: i.resolved ?? false,
          })),
        );
      }
    }

    // Inspections (+ attempts + item results). Requesting grants QA INSPECTOR access.
    for (const ins of def.inspections) {
      const iref = await nextRefCode(tx, "INS", YEAR);
      const last = ins.attempts.at(-1);
      const status = last ? last.outcome : "REQUESTED";
      const requestedAgo = ins.scheduledFor ? ins.scheduledFor : ago(10);
      const [insp] = await tx
        .insert(inspections)
        .values({
          refCode: iref,
          projectId,
          title: ins.title,
          area: ins.area ?? null,
          description: ins.description ?? null,
          scheduledFor: ins.scheduledFor ?? null,
          inspectorId: uid(QA),
          requestedById: uid(ins.requestedBy),
          checklistId: ins.checklist ? (checklistIdByName.get(ins.checklist) ?? null) : null,
          status,
          outcomeRemarks: last?.remarks ?? null,
          requestedAt: at(typeof requestedAgo === "string" ? requestedAgo : TODAY, "09:00:00"),
          inspectedAt: last ? at(ago(last.daysAgo), "15:00:00") : null,
        })
        .returning({ id: inspections.id });

      if (QA) {
        await tx
          .insert(projectMembers)
          .values({ projectId, userId: uid(QA)!, roleOnProject: "INSPECTOR" })
          .onConflictDoNothing({ target: [projectMembers.projectId, projectMembers.userId] });
      }

      let attemptNo = 0;
      for (const a of ins.attempts) {
        attemptNo += 1;
        const [attempt] = await tx
          .insert(inspectionAttempts)
          .values({
            inspectionId: insp.id,
            attemptNo,
            outcome: a.outcome,
            remarks: a.remarks ?? null,
            recordedById: uid(QA),
            recordedAt: at(ago(a.daysAgo), "15:00:00"),
          })
          .returning({ id: inspectionAttempts.id });
        await tx.insert(inspectionItemResults).values(
          a.items.map((it, j) => ({
            attemptId: attempt.id,
            label: it.label,
            result: it.result,
            remarks: it.remarks ?? null,
            sequence: j,
          })),
        );
      }
    }

    // Project notes (polymorphic)
    if (def.notes.length) {
      await tx.insert(notes).values(
        def.notes.map((body) => ({
          entityType: "project",
          entityId: projectId,
          body,
          createdBy: uid(def.lead),
        })),
      );
    }

    return { refCode, projectId };
  });
}

// ── The 6 demo projects (one per lifecycle state + a rich ACTIVE showcase) ────
function buildProjects(): ProjectDef[] {
  return [
    // 1) ACTIVE — the showcase: done + in-progress + blocked + delayed, DSRs, 3 inspections
    {
      name: "Greenfield Residences — Tower B",
      client: "Ayala Land, Inc.",
      status: "ACTIVE",
      lead: ENG1,
      members: [ENG2],
      contract: "185000000.00",
      location: "Brgy. San Antonio, Makati City",
      scope:
        "Construction of a 12-storey reinforced-concrete residential tower including structural, architectural, and MEPF works, plus two basement levels.",
      startDate: "2026-02-02",
      targetEndDate: "2026-11-30",
      phases: [
        {
          name: "Mobilization & Site Prep",
          targetStart: "2026-02-02",
          targetEnd: "2026-02-09",
          actualStart: "2026-02-02",
          actualEnd: "2026-02-11",
          tasks: [
            {
              name: "Site clearing & hauling",
              weight: 40,
              progress: 100,
              assignee: ENG1,
              targetStart: "2026-02-02",
              targetEnd: "2026-02-05",
              actualStart: "2026-02-02",
              actualEnd: "2026-02-05",
            },
            {
              name: "Temporary facilities & fencing",
              weight: 30,
              progress: 100,
              assignee: ENG2,
              targetStart: "2026-02-04",
              targetEnd: "2026-02-08",
              actualStart: "2026-02-04",
              actualEnd: "2026-02-09",
            },
            {
              name: "Survey & staking",
              weight: 30,
              progress: 100,
              assignee: ENG1,
              targetStart: "2026-02-06",
              targetEnd: "2026-02-09",
              actualStart: "2026-02-06",
              actualEnd: "2026-02-11",
            },
          ],
        },
        {
          name: "Earthworks & Foundation",
          targetStart: "2026-02-10",
          targetEnd: "2026-03-31",
          actualStart: "2026-02-12",
          actualEnd: "2026-04-04",
          tasks: [
            {
              name: "Bulk excavation",
              weight: 25,
              progress: 100,
              assignee: ENG2,
              targetEnd: "2026-02-25",
              actualEnd: "2026-02-27",
            },
            {
              name: "Footing formworks",
              weight: 25,
              progress: 100,
              assignee: ENG1,
              targetEnd: "2026-03-10",
              actualEnd: "2026-03-12",
            },
            {
              name: "Footing reinforcement",
              weight: 25,
              progress: 100,
              assignee: ENG1,
              targetEnd: "2026-03-20",
              actualEnd: "2026-03-22",
            },
            {
              name: "Mat foundation pour",
              weight: 25,
              progress: 100,
              assignee: ENG2,
              targetEnd: "2026-03-31",
              actualEnd: "2026-04-04",
            },
          ],
        },
        {
          name: "Structural Works",
          targetStart: "2026-04-06",
          targetEnd: "2026-08-15",
          actualStart: "2026-04-08",
          tasks: [
            {
              name: "Columns (L1–L6)",
              weight: 30,
              progress: 100,
              assignee: ENG1,
              targetEnd: "2026-05-30",
              actualEnd: "2026-06-02",
            },
            {
              name: "Beams (L1–L6)",
              weight: 25,
              progress: 80,
              assignee: ENG2,
              targetStart: "2026-05-15",
              targetEnd: "2026-06-18",
              actualStart: "2026-05-16",
              delayedFlag: true,
              remarks: "Pour for L5 slipped — rebar delivery was late.",
            },
            {
              name: "Suspended slabs",
              weight: 25,
              progress: 40,
              assignee: ENG1,
              targetStart: "2026-06-01",
              targetEnd: "2026-07-10",
              actualStart: "2026-06-05",
              blockedReason: "Pump-truck breakdown — awaiting replacement from supplier.",
            },
            {
              name: "Staircase & shear walls",
              weight: 20,
              progress: 0,
              assignee: ENG2,
              targetStart: "2026-07-01",
              targetEnd: "2026-08-15",
            },
          ],
        },
        {
          name: "Masonry & Architectural",
          targetStart: "2026-07-20",
          targetEnd: "2026-10-05",
          tasks: [
            {
              name: "CHB laying",
              weight: 35,
              progress: 20,
              assignee: ENG2,
              targetStart: "2026-07-20",
              targetEnd: "2026-09-01",
            },
            {
              name: "Plastering",
              weight: 35,
              progress: 0,
              assignee: ENG1,
              targetStart: "2026-08-15",
              targetEnd: "2026-09-20",
            },
            {
              name: "Tile & finishes",
              weight: 30,
              progress: 0,
              assignee: ENG2,
              targetStart: "2026-09-01",
              targetEnd: "2026-10-05",
            },
          ],
        },
        {
          name: "MEPF Rough-in",
          targetStart: "2026-08-01",
          targetEnd: "2026-10-20",
          tasks: [
            {
              name: "Electrical rough-in",
              weight: 40,
              progress: 0,
              assignee: ENG1,
              targetEnd: "2026-09-30",
            },
            {
              name: "Plumbing rough-in",
              weight: 35,
              progress: 0,
              assignee: ENG2,
              targetEnd: "2026-10-10",
            },
            {
              name: "Mechanical rough-in",
              weight: 25,
              progress: 0,
              assignee: ENG1,
              targetEnd: "2026-10-20",
            },
          ],
        },
        {
          name: "Finishing & Turnover",
          targetStart: "2026-10-10",
          targetEnd: "2026-11-30",
          tasks: [
            { name: "Painting", weight: 40, progress: 0, assignee: ENG2, targetEnd: "2026-11-10" },
            {
              name: "Fixtures & fittings",
              weight: 35,
              progress: 0,
              assignee: ENG1,
              targetEnd: "2026-11-22",
            },
            {
              name: "Punchlist & cleanup",
              weight: 25,
              progress: 0,
              assignee: ENG2,
              targetEnd: "2026-11-30",
            },
          ],
        },
      ],
      dsrs: [
        {
          daysAgo: 0,
          status: "DRAFT",
          author: ENG1,
          weather: "Partly cloudy, brief afternoon shower",
          workAccomplished: "Continued L5 slab rebar tying; formwork for column line C.",
          nextDayPlan: "Pour L5 slab section A if pump truck is restored.",
          progressNote:
            "Slab works held by pump-truck breakdown; foreman coordinating with supplier.",
          manpower: [
            { employee: "Ramon dela Cruz", trade: "FOREMAN", headcount: 1, hours: 9 },
            { employee: "Miguel Torres", trade: "REBAR", headcount: 6, hours: 8 },
            { employee: "Carlos Aquino", trade: "CARPENTER", headcount: 4, hours: 8 },
            { employee: "Felipe Domingo", trade: "LABORER", headcount: 8, hours: 8 },
          ],
          equipment: [
            { name: "Tower crane", quantity: 1, hours: 8 },
            {
              name: "Concrete pump truck",
              quantity: 1,
              hours: 0,
              remarks: "Down — hydraulic fault",
            },
          ],
          materials: [
            { description: "Deformed rebar 16mm", quantity: 1.2, unit: "ton" },
            { description: "Tie wire", quantity: 25, unit: "kg" },
          ],
          issues: [
            { description: "Pump truck hydraulic failure halted slab pour", severity: "HIGH" },
            {
              description: "Minor housekeeping at material laydown area",
              severity: "LOW",
              resolved: true,
            },
          ],
        },
        {
          daysAgo: 1,
          status: "SUBMITTED",
          author: ENG1,
          weather: "Sunny",
          workAccomplished: "Completed L5 beam pour line A–C; cured L4 columns.",
          nextDayPlan: "Start L5 slab rebar.",
          progressNote: "On track aside from beam line D.",
          manpower: [
            { employee: "Ramon dela Cruz", trade: "FOREMAN", headcount: 1, hours: 9 },
            { employee: "Miguel Torres", trade: "REBAR", headcount: 5, hours: 8 },
            { employee: "Pedro Bautista", trade: "MASON", headcount: 4, hours: 8 },
          ],
          equipment: [
            { name: "Tower crane", quantity: 1, hours: 8 },
            { name: "Concrete mixer", quantity: 2, hours: 6 },
          ],
          materials: [{ description: "Ready-mix concrete 28MPa", quantity: 36, unit: "m3" }],
          issues: [],
        },
        {
          daysAgo: 4,
          status: "SUBMITTED",
          author: ENG2,
          weather: "Overcast",
          workAccomplished: "Stripped L4 column forms; delivered rebar for L5.",
          nextDayPlan: "Erect L5 beam formwork.",
          manpower: [
            { employee: "Carlos Aquino", trade: "CARPENTER", headcount: 5, hours: 8 },
            { employee: "Felipe Domingo", trade: "LABORER", headcount: 6, hours: 8 },
          ],
          equipment: [{ name: "Tower crane", quantity: 1, hours: 7 }],
          materials: [{ description: "Phenolic plywood 18mm", quantity: 40, unit: "sheet" }],
          issues: [
            {
              description: "Late rebar delivery delayed beam line D",
              severity: "MEDIUM",
              resolved: true,
            },
          ],
        },
        {
          daysAgo: 7,
          status: "SUBMITTED",
          author: ENG1,
          weather: "Sunny",
          workAccomplished: "Poured L4 columns; QA/QC rebar inspection passed on re-check.",
          nextDayPlan: "Strip column forms after 24h.",
          manpower: [
            { employee: "Ramon dela Cruz", trade: "FOREMAN", headcount: 1, hours: 9 },
            { employee: "Miguel Torres", trade: "REBAR", headcount: 6, hours: 8 },
          ],
          equipment: [{ name: "Concrete pump truck", quantity: 1, hours: 6 }],
          materials: [{ description: "Ready-mix concrete 28MPa", quantity: 28, unit: "m3" }],
          issues: [],
        },
      ],
      inspections: [
        {
          title: "L4 column rebar inspection",
          area: "Level 4 — Grid C/3",
          description: "Verify reinforcement before formwork closure for L4 columns.",
          scheduledFor: ago(9),
          requestedBy: ENG1,
          checklist: "Structural Rebar Inspection",
          attempts: [
            {
              outcome: "FAILED",
              daysAgo: 9,
              remarks: "Tie spacing exceeded at two columns; insufficient cover at C3.",
              items: [
                { label: "Bar diameter matches the bar schedule", result: "PASS" },
                {
                  label: "Spacing and clear cover within tolerance",
                  result: "FAIL",
                  remarks: "Cover < 40mm at C3.",
                },
                { label: "Lap splice lengths and stagger correct", result: "PASS" },
                {
                  label: "Stirrup / tie spacing and hooks compliant",
                  result: "FAIL",
                  remarks: "Ties at 250mm vs 200mm spec.",
                },
                { label: "Reinforcement clean — no loose rust, oil, or mud", result: "PASS" },
              ],
            },
            {
              outcome: "PASSED",
              daysAgo: 7,
              remarks: "Corrections verified — tie spacing and cover now compliant.",
              items: [
                { label: "Bar diameter matches the bar schedule", result: "PASS" },
                { label: "Spacing and clear cover within tolerance", result: "PASS" },
                { label: "Lap splice lengths and stagger correct", result: "PASS" },
                { label: "Stirrup / tie spacing and hooks compliant", result: "PASS" },
                { label: "Reinforcement clean — no loose rust, oil, or mud", result: "PASS" },
              ],
            },
          ],
        },
        {
          title: "L5 slab pre-pour inspection",
          area: "Level 5 — Section A",
          description: "Pre-pour concrete checks for the L5 suspended slab.",
          scheduledFor: ago(1),
          requestedBy: ENG2,
          checklist: "Concrete Pouring Inspection",
          attempts: [],
        },
        {
          title: "Basement waterproofing inspection",
          area: "Basement 2",
          description: "Membrane continuity and lap checks before backfill.",
          scheduledFor: ago(3),
          requestedBy: ENG1,
          attempts: [
            {
              outcome: "FAILED",
              daysAgo: 3,
              remarks: "Membrane laps short at the north wall; re-do before backfill.",
              items: [
                {
                  label: "Membrane continuous, no punctures",
                  result: "FAIL",
                  remarks: "Short laps at NW corner.",
                },
                { label: "Laps overlap ≥ 100mm and sealed", result: "FAIL" },
                { label: "Protection board installed", result: "NA" },
              ],
            },
          ],
        },
      ],
      notes: [
        "Client requested weekly photo updates every Friday. Coordinate with the foreman.",
        "Pump-truck supplier committed to a replacement unit within 48 hours (logged 2 days ago).",
      ],
    },

    // 2) ACTIVE — early stage, an overdue task, a blocked task
    {
      name: "EDSA–Kamuning Flyover Rehabilitation",
      client: "Department of Public Works and Highways",
      status: "ACTIVE",
      lead: ENG2,
      members: [ENG1],
      contract: "92500000.00",
      location: "EDSA cor. Kamuning Road, Quezon City",
      scope:
        "Rehabilitation of the Kamuning flyover deck including expansion joints, drainage, repaving, and railing replacement under nighttime closures.",
      startDate: "2026-05-04",
      targetEndDate: "2026-12-15",
      phases: [
        {
          name: "Survey & Staking",
          targetStart: "2026-05-04",
          targetEnd: "2026-05-09",
          actualStart: "2026-05-04",
          actualEnd: "2026-05-10",
          tasks: [
            {
              name: "Topographic & condition survey",
              weight: 50,
              progress: 100,
              assignee: ENG2,
              targetEnd: "2026-05-07",
              actualEnd: "2026-05-08",
            },
            {
              name: "Staking & traffic plan",
              weight: 50,
              progress: 100,
              assignee: ENG1,
              targetEnd: "2026-05-09",
              actualEnd: "2026-05-10",
            },
          ],
        },
        {
          name: "Subgrade & Deck Prep",
          targetStart: "2026-05-11",
          targetEnd: "2026-07-05",
          actualStart: "2026-05-12",
          tasks: [
            {
              name: "Demolition of damaged deck sections",
              weight: 30,
              progress: 60,
              assignee: ENG1,
              targetStart: "2026-05-12",
              targetEnd: "2026-06-15",
              actualStart: "2026-05-12",
              delayedFlag: true,
              remarks: "Behind due to extended permit for night closures.",
            },
            {
              name: "Expansion joint replacement",
              weight: 40,
              progress: 30,
              assignee: ENG2,
              targetStart: "2026-06-01",
              targetEnd: "2026-07-01",
            },
            {
              name: "Drainage rework",
              weight: 30,
              progress: 0,
              assignee: ENG1,
              targetStart: "2026-06-10",
              targetEnd: "2026-07-05",
              blockedReason: "Utility conflict — Maynilad line not yet relocated.",
            },
          ],
        },
        {
          name: "Base Course",
          targetStart: "2026-07-06",
          targetEnd: "2026-08-15",
          tasks: [
            {
              name: "Aggregate base course",
              weight: 60,
              progress: 0,
              assignee: ENG2,
              targetEnd: "2026-08-01",
            },
            {
              name: "Grading & compaction",
              weight: 40,
              progress: 0,
              assignee: ENG1,
              targetEnd: "2026-08-15",
            },
          ],
        },
        {
          name: "PCCP Pouring",
          targetStart: "2026-08-16",
          targetEnd: "2026-10-30",
          tasks: [
            {
              name: "Formworks & dowels",
              weight: 50,
              progress: 0,
              assignee: ENG2,
              targetEnd: "2026-09-30",
            },
            {
              name: "Concrete pouring",
              weight: 50,
              progress: 0,
              assignee: ENG1,
              targetEnd: "2026-10-30",
            },
          ],
        },
        {
          name: "Curing & Joints",
          targetStart: "2026-10-31",
          targetEnd: "2026-11-25",
          tasks: [
            { name: "Curing", weight: 60, progress: 0, assignee: ENG2, targetEnd: "2026-11-15" },
            {
              name: "Joint sealing",
              weight: 40,
              progress: 0,
              assignee: ENG1,
              targetEnd: "2026-11-25",
            },
          ],
        },
        {
          name: "Railings & Turnover",
          targetStart: "2026-11-26",
          targetEnd: "2026-12-15",
          tasks: [
            {
              name: "Railing replacement",
              weight: 60,
              progress: 0,
              assignee: ENG2,
              targetEnd: "2026-12-08",
            },
            {
              name: "Final cleanup & turnover",
              weight: 40,
              progress: 0,
              assignee: ENG1,
              targetEnd: "2026-12-15",
            },
          ],
        },
      ],
      dsrs: [
        {
          daysAgo: 0,
          status: "DRAFT",
          author: ENG2,
          weather: "Clear night",
          workAccomplished: "Demolished deck section between piers 3–4 during 11pm–4am closure.",
          nextDayPlan: "Haul out debris; survey joint pockets.",
          manpower: [
            {
              employee: "Antonio Castro",
              trade: "HEAVY_EQUIPMENT_OPERATOR",
              headcount: 2,
              hours: 6,
            },
            { employee: "Felipe Domingo", trade: "LABORER", headcount: 10, hours: 6 },
            { employee: "Ricardo Navarro", trade: "SAFETY_OFFICER", headcount: 1, hours: 6 },
          ],
          equipment: [
            { name: "Breaker excavator", quantity: 2, hours: 5 },
            { name: "Dump truck", quantity: 3, hours: 5 },
          ],
          materials: [],
          issues: [
            {
              description: "Traffic re-opening delayed by 20 minutes — coordinate with MMDA",
              severity: "MEDIUM",
            },
          ],
        },
        {
          daysAgo: 2,
          status: "SUBMITTED",
          author: ENG2,
          weather: "Clear night",
          workAccomplished:
            "Set up night-closure traffic management; began deck demolition pier 3.",
          nextDayPlan: "Continue demolition to pier 4.",
          manpower: [
            {
              employee: "Antonio Castro",
              trade: "HEAVY_EQUIPMENT_OPERATOR",
              headcount: 2,
              hours: 6,
            },
            { employee: "Ricardo Navarro", trade: "SAFETY_OFFICER", headcount: 1, hours: 6 },
          ],
          equipment: [{ name: "Breaker excavator", quantity: 1, hours: 5 }],
          materials: [{ description: "Traffic cones & barriers", quantity: 1, unit: "lot" }],
          issues: [{ description: "Maynilad line relocation still pending", severity: "HIGH" }],
        },
      ],
      inspections: [
        {
          title: "Expansion joint pocket inspection",
          area: "Pier 3–4",
          description: "Verify joint pocket dimensions and rebar before grouting.",
          scheduledFor: ago(0),
          requestedBy: ENG2,
          checklist: "Structural Rebar Inspection",
          attempts: [],
        },
      ],
      notes: [
        "Night-only closures permitted 11pm–4am. All pours must be scheduled within this window.",
      ],
    },

    // 3) PLANNING — 0% across the board, future schedule, no field activity yet
    {
      name: "Seaside Commercial Complex",
      client: "SM Prime Holdings, Inc.",
      status: "PLANNING",
      lead: ENG1,
      members: [ENG2],
      contract: "240000000.00",
      location: "Mall of Asia Complex, Pasay City",
      scope:
        "Design-and-build of a 3-level commercial podium with roof-deck parking, anchor retail, and a central atrium.",
      startDate: "2026-07-20",
      targetEndDate: "2027-06-30",
      phases: [
        {
          name: "Mobilization & Site Prep",
          targetStart: "2026-07-20",
          targetEnd: "2026-07-27",
          tasks: [
            {
              name: "Site clearing & hauling",
              weight: 40,
              progress: 0,
              assignee: ENG1,
              targetEnd: "2026-07-24",
            },
            {
              name: "Temporary facilities",
              weight: 30,
              progress: 0,
              assignee: ENG2,
              targetEnd: "2026-07-26",
            },
            {
              name: "Survey & staking",
              weight: 30,
              progress: 0,
              assignee: ENG1,
              targetEnd: "2026-07-27",
            },
          ],
        },
        {
          name: "Earthworks & Foundation",
          targetStart: "2026-07-28",
          targetEnd: "2026-09-20",
          tasks: [
            {
              name: "Bored piles",
              weight: 40,
              progress: 0,
              assignee: ENG2,
              targetEnd: "2026-08-25",
            },
            {
              name: "Pile caps & tie beams",
              weight: 35,
              progress: 0,
              assignee: ENG1,
              targetEnd: "2026-09-10",
            },
            {
              name: "Ground slab",
              weight: 25,
              progress: 0,
              assignee: ENG2,
              targetEnd: "2026-09-20",
            },
          ],
        },
        {
          name: "Structural Works",
          targetStart: "2026-09-21",
          targetEnd: "2027-01-31",
          tasks: [
            { name: "Columns", weight: 35, progress: 0, assignee: ENG1, targetEnd: "2026-11-30" },
            {
              name: "Beams & slabs",
              weight: 40,
              progress: 0,
              assignee: ENG2,
              targetEnd: "2026-12-31",
            },
            {
              name: "Roof-deck framing",
              weight: 25,
              progress: 0,
              assignee: ENG1,
              targetEnd: "2027-01-31",
            },
          ],
        },
        {
          name: "Architectural & MEPF",
          targetStart: "2027-02-01",
          targetEnd: "2027-05-15",
          tasks: [
            {
              name: "Façade & curtain wall",
              weight: 40,
              progress: 0,
              assignee: ENG2,
              targetEnd: "2027-03-31",
            },
            {
              name: "MEPF rough-in & fit-out",
              weight: 60,
              progress: 0,
              assignee: ENG1,
              targetEnd: "2027-05-15",
            },
          ],
        },
        {
          name: "Finishing & Turnover",
          targetStart: "2027-05-16",
          targetEnd: "2027-06-30",
          tasks: [
            {
              name: "Tenant handover prep",
              weight: 50,
              progress: 0,
              assignee: ENG2,
              targetEnd: "2027-06-15",
            },
            {
              name: "Punchlist & turnover",
              weight: 50,
              progress: 0,
              assignee: ENG1,
              targetEnd: "2027-06-30",
            },
          ],
        },
      ],
      dsrs: [],
      inspections: [],
      notes: [
        "Awaiting building permit release before mobilization. Geotech report received; pile design under review.",
      ],
    },

    // 4) ON_HOLD — mid-progress with a blocking issue
    {
      name: "Northgate Warehouse Facility",
      client: "Robinsons Land Corporation",
      status: "ON_HOLD",
      lead: ENG2,
      members: [ENG1],
      contract: "65000000.00",
      location: "Laguna Technopark, Biñan, Laguna",
      scope: "Pre-engineered steel warehouse (4,500 sqm) with mezzanine office and truck court.",
      startDate: "2026-01-12",
      targetEndDate: "2026-08-30",
      phases: [
        {
          name: "Site Prep & Foundation",
          targetStart: "2026-01-12",
          targetEnd: "2026-03-01",
          actualStart: "2026-01-12",
          actualEnd: "2026-03-05",
          tasks: [
            {
              name: "Site grading",
              weight: 35,
              progress: 100,
              assignee: ENG2,
              targetEnd: "2026-01-31",
              actualEnd: "2026-02-02",
            },
            {
              name: "Column footings",
              weight: 35,
              progress: 100,
              assignee: ENG1,
              targetEnd: "2026-02-20",
              actualEnd: "2026-02-24",
            },
            {
              name: "Slab-on-grade",
              weight: 30,
              progress: 100,
              assignee: ENG2,
              targetEnd: "2026-03-01",
              actualEnd: "2026-03-05",
            },
          ],
        },
        {
          name: "Steel Erection",
          targetStart: "2026-03-06",
          targetEnd: "2026-05-30",
          actualStart: "2026-03-10",
          tasks: [
            {
              name: "Primary frame erection",
              weight: 50,
              progress: 60,
              assignee: ENG1,
              targetStart: "2026-03-10",
              targetEnd: "2026-04-30",
              actualStart: "2026-03-10",
            },
            {
              name: "Purlins & bracing",
              weight: 50,
              progress: 20,
              assignee: ENG2,
              targetStart: "2026-04-15",
              targetEnd: "2026-05-30",
              blockedReason: "On hold — client reviewing revised cladding specification.",
            },
          ],
        },
        {
          name: "Cladding & Roofing",
          targetStart: "2026-06-01",
          targetEnd: "2026-07-15",
          tasks: [
            {
              name: "Roof sheeting",
              weight: 50,
              progress: 0,
              assignee: ENG1,
              targetEnd: "2026-06-30",
            },
            {
              name: "Wall cladding",
              weight: 50,
              progress: 0,
              assignee: ENG2,
              targetEnd: "2026-07-15",
            },
          ],
        },
        {
          name: "Fit-out & Turnover",
          targetStart: "2026-07-16",
          targetEnd: "2026-08-30",
          tasks: [
            {
              name: "Mezzanine office fit-out",
              weight: 60,
              progress: 0,
              assignee: ENG1,
              targetEnd: "2026-08-20",
            },
            {
              name: "Punchlist & turnover",
              weight: 40,
              progress: 0,
              assignee: ENG2,
              targetEnd: "2026-08-30",
            },
          ],
        },
      ],
      dsrs: [
        {
          daysAgo: 30,
          status: "SUBMITTED",
          author: ENG2,
          weather: "Hot & humid",
          workAccomplished: "Erected primary frames bays 1–6; bolted base plates.",
          nextDayPlan: "Continue frame erection bays 7–10.",
          manpower: [
            { employee: "Eduardo Ramos", trade: "WELDER", headcount: 4, hours: 8 },
            {
              employee: "Antonio Castro",
              trade: "HEAVY_EQUIPMENT_OPERATOR",
              headcount: 1,
              hours: 8,
            },
            { employee: "Felipe Domingo", trade: "LABORER", headcount: 6, hours: 8 },
          ],
          equipment: [
            { name: "Mobile crane 25T", quantity: 1, hours: 8 },
            { name: "Welding machine", quantity: 4, hours: 8 },
          ],
          materials: [
            { description: "Structural steel I-beams", quantity: 18, unit: "ton" },
            { description: "Anchor bolts M24", quantity: 96, unit: "pcs" },
          ],
          issues: [
            {
              description: "Client flagged cladding spec change — pending decision",
              severity: "HIGH",
            },
          ],
        },
      ],
      inspections: [],
      notes: [
        "Project placed ON HOLD pending client decision on revised insulated cladding spec. Steel erection ~40% complete at hold.",
      ],
    },

    // 5) COMPLETED — 100%, signed off, currently in defects-liability (in warranty)
    {
      name: "Riverside Bridge Approach Road",
      client: "Department of Public Works and Highways",
      status: "COMPLETED",
      lead: ENG1,
      members: [ENG2],
      contract: "48750000.00",
      location: "Marikina River Bank, Marikina City",
      scope:
        "420-lm concrete approach road and embankment protection for the Riverside pedestrian bridge.",
      startDate: "2025-08-01",
      targetEndDate: "2026-03-31",
      actualEndDate: "2026-04-10",
      defectsLiabilityUntil: "2027-04-10",
      phases: [
        {
          name: "Survey & Subgrade",
          targetStart: "2025-08-01",
          targetEnd: "2025-09-15",
          actualStart: "2025-08-01",
          actualEnd: "2025-09-18",
          tasks: [
            {
              name: "Survey & staking",
              weight: 40,
              progress: 100,
              assignee: ENG1,
              actualEnd: "2025-08-20",
            },
            {
              name: "Subgrade preparation",
              weight: 60,
              progress: 100,
              assignee: ENG2,
              actualEnd: "2025-09-18",
            },
          ],
        },
        {
          name: "Base Course",
          targetStart: "2025-09-16",
          targetEnd: "2025-11-10",
          actualStart: "2025-09-20",
          actualEnd: "2025-11-15",
          tasks: [
            {
              name: "Aggregate base course",
              weight: 60,
              progress: 100,
              assignee: ENG1,
              actualEnd: "2025-10-25",
            },
            {
              name: "Grading & compaction",
              weight: 40,
              progress: 100,
              assignee: ENG2,
              actualEnd: "2025-11-15",
            },
          ],
        },
        {
          name: "PCCP & Drainage",
          targetStart: "2025-11-16",
          targetEnd: "2026-02-20",
          actualStart: "2025-11-20",
          actualEnd: "2026-02-28",
          tasks: [
            {
              name: "Concrete pavement",
              weight: 60,
              progress: 100,
              assignee: ENG1,
              actualEnd: "2026-02-10",
            },
            {
              name: "RCBC & drainage",
              weight: 40,
              progress: 100,
              assignee: ENG2,
              actualEnd: "2026-02-28",
            },
          ],
        },
        {
          name: "Finishing & Turnover",
          targetStart: "2026-02-21",
          targetEnd: "2026-03-31",
          actualStart: "2026-03-01",
          actualEnd: "2026-04-10",
          tasks: [
            {
              name: "Pavement markings & signage",
              weight: 50,
              progress: 100,
              assignee: ENG1,
              actualEnd: "2026-03-25",
            },
            {
              name: "Final cleanup & turnover",
              weight: 50,
              progress: 100,
              assignee: ENG2,
              actualEnd: "2026-04-10",
            },
          ],
        },
      ],
      dsrs: [
        {
          daysAgo: 80,
          status: "SUBMITTED",
          author: ENG1,
          weather: "Sunny",
          workAccomplished: "Completed concrete pavement station 0+200 to 0+320.",
          nextDayPlan: "Curing; begin shoulder works.",
          manpower: [
            { employee: "Ramon dela Cruz", trade: "FOREMAN", headcount: 1, hours: 9 },
            { employee: "Pedro Bautista", trade: "MASON", headcount: 5, hours: 8 },
          ],
          equipment: [
            { name: "Concrete paver", quantity: 1, hours: 7 },
            { name: "Vibrating screed", quantity: 2, hours: 7 },
          ],
          materials: [{ description: "Ready-mix concrete 24MPa", quantity: 64, unit: "m3" }],
          issues: [],
        },
        {
          daysAgo: 76,
          status: "SUBMITTED",
          author: ENG2,
          weather: "Sunny",
          workAccomplished: "Curing of poured slab; installed RCBC at station 0+260.",
          nextDayPlan: "Drainage backfill.",
          manpower: [{ employee: "Felipe Domingo", trade: "LABORER", headcount: 8, hours: 8 }],
          equipment: [{ name: "Backhoe", quantity: 1, hours: 6 }],
          materials: [{ description: "RCBC pipe 900mm", quantity: 12, unit: "length" }],
          issues: [],
        },
      ],
      inspections: [
        {
          title: "Pavement pre-pour inspection — Sta 0+200",
          area: "Station 0+200–0+320",
          description: "Final pre-pour check for the approach road slab.",
          scheduledFor: ago(82),
          requestedBy: ENG1,
          checklist: "Concrete Pouring Inspection",
          attempts: [
            {
              outcome: "PASSED",
              daysAgo: 81,
              remarks: "All pre-pour items satisfactory; cleared to pour.",
              items: [
                { label: "Formworks aligned, tight, and adequately braced", result: "PASS" },
                {
                  label: "Rebar size, spacing, and lap length per structural plan",
                  result: "PASS",
                },
                { label: "Concrete cover maintained with spacers/chairs", result: "PASS" },
                { label: "Embedded items and sleeves in correct position", result: "NA" },
                { label: "Slump test within approved tolerance", result: "PASS" },
                { label: "Adequate vibration / consolidation during pour", result: "PASS" },
              ],
            },
          ],
        },
      ],
      notes: [
        "Turned over and accepted by DPWH on 10 Apr 2026. Defects-liability period runs to 10 Apr 2027.",
      ],
    },

    // 6) CANCELLED — abandoned early
    {
      name: "Hilltop Subdivision — Phase 1 Roads",
      client: "Megaworld Corporation",
      status: "CANCELLED",
      lead: ENG2,
      members: [ENG1],
      contract: "120000000.00",
      location: "Antipolo City, Rizal",
      scope:
        "Site development and concrete roads for Phase 1 (62 lots) of a hillside residential subdivision.",
      startDate: "2026-03-01",
      targetEndDate: "2026-12-20",
      phases: [
        {
          name: "Survey & Earthworks",
          targetStart: "2026-03-01",
          targetEnd: "2026-05-15",
          actualStart: "2026-03-03",
          tasks: [
            {
              name: "Topographic survey",
              weight: 30,
              progress: 100,
              assignee: ENG2,
              actualEnd: "2026-03-15",
            },
            {
              name: "Site grading & benching",
              weight: 40,
              progress: 50,
              assignee: ENG1,
              targetEnd: "2026-04-30",
              actualStart: "2026-03-20",
            },
            {
              name: "Slope protection",
              weight: 30,
              progress: 0,
              assignee: ENG2,
              targetEnd: "2026-05-15",
            },
          ],
        },
        {
          name: "Drainage & Utilities",
          targetStart: "2026-05-16",
          targetEnd: "2026-08-15",
          tasks: [
            {
              name: "Storm drainage",
              weight: 50,
              progress: 0,
              assignee: ENG1,
              targetEnd: "2026-07-15",
            },
            {
              name: "Water & power conduits",
              weight: 50,
              progress: 0,
              assignee: ENG2,
              targetEnd: "2026-08-15",
            },
          ],
        },
        {
          name: "Concrete Roads",
          targetStart: "2026-08-16",
          targetEnd: "2026-12-20",
          tasks: [
            {
              name: "Subbase & base course",
              weight: 40,
              progress: 0,
              assignee: ENG1,
              targetEnd: "2026-10-15",
            },
            {
              name: "PCCP roads",
              weight: 60,
              progress: 0,
              assignee: ENG2,
              targetEnd: "2026-12-20",
            },
          ],
        },
      ],
      dsrs: [
        {
          daysAgo: 95,
          status: "SUBMITTED",
          author: ENG2,
          weather: "Foggy morning",
          workAccomplished: "Benching of upper terrace; hauled cut to fill area.",
          nextDayPlan: "Continue benching; set slope monitoring pins.",
          manpower: [
            {
              employee: "Antonio Castro",
              trade: "HEAVY_EQUIPMENT_OPERATOR",
              headcount: 2,
              hours: 8,
            },
            { employee: "Felipe Domingo", trade: "LABORER", headcount: 6, hours: 8 },
          ],
          equipment: [
            { name: "Bulldozer", quantity: 1, hours: 8 },
            { name: "Excavator", quantity: 2, hours: 8 },
          ],
          materials: [],
          issues: [
            {
              description: "Soft spot encountered on upper terrace — possible spring",
              severity: "MEDIUM",
            },
          ],
        },
      ],
      inspections: [],
      notes: [
        "Project CANCELLED — client suspended the development after a geohazard re-assessment flagged slope-stability risk on the upper terraces.",
      ],
    },
  ];
}

async function seedNotifications(projectIds: Record<string, string>): Promise<void> {
  const tower = projectIds["Greenfield Residences — Tower B"];
  const flyover = projectIds["EDSA–Kamuning Flyover Rehabilitation"];

  type N = {
    eventKey: string;
    recipient: string;
    subject: string;
    body: string;
    read: boolean;
    daysAgo: number;
    entityType?: string;
    entityId?: string;
  };
  const rows: N[] = [
    {
      eventKey: "task.assigned",
      recipient: ENG2,
      subject: "You were assigned a task",
      body: 'You were assigned the task "Beams (L1–L6)" on Greenfield Residences — Tower B.',
      read: false,
      daysAgo: 0,
      entityType: "project",
      entityId: tower,
    },
    {
      eventKey: "task.blocked",
      recipient: ADMIN,
      subject: "A task was blocked",
      body: 'Task "Suspended slabs" was blocked — Pump-truck breakdown — awaiting replacement from supplier.',
      read: false,
      daysAgo: 0,
      entityType: "project",
      entityId: tower,
    },
    {
      eventKey: "dsr.issue.flagged",
      recipient: ADMIN,
      subject: "High-severity site issue",
      body: "Daily report DSR-2026 flagged a high-severity site issue on Greenfield Residences — Tower B.",
      read: false,
      daysAgo: 1,
      entityType: "project",
      entityId: tower,
    },
    {
      eventKey: "dsr.submitted",
      recipient: ENG1,
      subject: "Daily report submitted",
      body: "A daily report was submitted for EDSA–Kamuning Flyover Rehabilitation.",
      read: true,
      daysAgo: 2,
      entityType: "project",
      entityId: flyover,
    },
    {
      eventKey: "inspection.completed",
      recipient: ENG1,
      subject: "Inspection completed",
      body: 'Inspection "L4 column rebar inspection" was passed.',
      read: true,
      daysAgo: 7,
      entityType: "project",
      entityId: tower,
    },
    {
      eventKey: "inspection.requested",
      recipient: QA || ENG2,
      subject: "Inspection requested",
      body: 'You were asked to inspect "L5 slab pre-pour inspection".',
      read: false,
      daysAgo: 1,
      entityType: "project",
      entityId: tower,
    },
    {
      eventKey: "project.created",
      recipient: ADMIN,
      subject: "Project created",
      body: "Project Seaside Commercial Complex was created.",
      read: true,
      daysAgo: 5,
      entityType: "project",
      entityId: projectIds["Seaside Commercial Complex"],
    },
  ];

  let n = 0;
  for (const r of rows) {
    const recipientId = uid(r.recipient);
    if (!recipientId) continue;
    await db.insert(notifications).values({
      eventKey: r.eventKey,
      recipientId,
      channel: "IN_APP",
      subject: r.subject,
      body: r.body,
      status: r.read ? "READ" : "SENT",
      idempotencyKey: `${DEMO_NOTIF_PREFIX}${n}`,
      entityType: r.entityType ?? null,
      entityId: r.entityId ?? null,
      createdAt: at(ago(r.daysAgo), "10:15:00"),
      sentAt: at(ago(r.daysAgo), "10:15:00"),
      readAt: r.read ? at(ago(r.daysAgo), "11:00:00") : null,
    });
    n++;
  }
  console.log(`✓ in-app notifications seeded (${n})`);
}

async function main(): Promise<void> {
  console.log("Seeding Stage 2 demo data…\n");
  await resolveUsers();
  await loadUserIds();
  console.log(`Using engineers: ${ENG1}, ${ENG2}; QA/QC: ${QA || "(none)"}; admin: ${ADMIN}\n`);

  const clientMap = await ensureClients();
  await ensureEmployees();
  await ensureChecklists();
  await ensureTemplates();

  const projectDefs = buildProjects();
  await wipeDemoProjects(projectDefs.map((p) => p.name));

  const projectIds: Record<string, string> = {};
  for (const def of projectDefs) {
    const { refCode, projectId } = await createProject(def, clientMap);
    projectIds[def.name] = projectId;
    console.log(
      `＋ ${refCode}  ${def.name}  [${def.status}]  ${def.phases.length} phases, ${def.dsrs.length} DSRs, ${def.inspections.length} inspections`,
    );
  }

  await seedNotifications(projectIds);

  console.log("\nStage 2 demo seed complete.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Demo seed failed:", error);
    process.exit(1);
  });

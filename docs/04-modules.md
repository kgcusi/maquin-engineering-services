# 04 — Module Specifications

One spec per module. Each lists: **Purpose**, **Key data** (→ [02](02-data-model.md)), **Screens**,
**Rules** (the logic that must be enforced server-side), **Events** emitted (→
[08](08-notifications.md)), **Permissions** (→ [03](03-roles-and-permissions.md)), and
**Done when** (acceptance criteria for the build).

Modules are numbered to match the proposal (§5.1–§5.21).

---

## Core System

### 5.1 User & Authentication
**Purpose.** Accounts, login/logout, role-based access, active/inactive status.

**Key data.** `users`, `roles`/`permissions`, sessions.

**Screens.** Login · Users list (admin) · Create/edit user · Change-password / profile · "Account inactive" notice.

**Rules.**
- No public sign-up; admins create users. First admin via seed.
- Passwords hashed by **Better Auth** (scrypt by default), stored in `account.password` — not on
  `user` ([17](17-audit-decisions.md) §3); enforce a minimum length (8).
- Inactive users cannot authenticate; active sessions for a deactivated user are invalidated.
- Failed-login rate limiting; generic error messages (no "user not found" leak).
- Session via HTTP-only secure cookie; CSRF protection on mutations.
- Deactivate, never hard-delete (history depends on the user row).

**Events.** `user.created`, `user.deactivated`, `auth.login.failed` (×N → optional alert).

**Permissions.** `user.*`.

**Done when.** Admin can create an engineer who can log in, see only their projects, and be
deactivated; a deactivated user is locked out immediately.

---

### 5.2 Audit Trail / Activity Logs
**Purpose.** Immutable record of important actions.

**Key data.** `audit_logs` ([02](02-data-model.md) §2.3).

**Screens.** Audit log viewer with filters (actor, action, entity type, date range) and a
per-entity "history" panel surfaced on detail pages.

**Rules.**
- Append-only; no edit/delete in the UI or API.
- Logged actions (minimum): project create/update, DSR submit, MR approve/reject, release,
  site receiving, expense approve/reject, stock adjustment, damage/loss posting, notification
  send, user create/deactivate, login failures.
- Capture actor, action key, entity ref, a human summary, and a `diff` of changed fields.
- Writing the audit row is part of the same transaction as the action it records.

**Events.** none (it consumes events/actions).

**Permissions.** `audit.view` (Admin).

**Done when.** Approving an MR produces an immutable log row visible in the viewer and on the
MR's history panel, with before/after status.

Full detail: [12-audit-trail.md](12-audit-trail.md).

---

### 5.3 System Settings
**Purpose.** App configuration. (Option lists — statuses, categories, units, trades — are **fixed
in code**, not admin-editable; see [17](17-audit-decisions.md) §9. The per-list CRUD managers are
**dropped**.)

**Key data.** `app_settings`, `notification_settings` ([02](02-data-model.md) §2.4). The former
lookup values now live in code: `src/lib/lookups.ts` (units, trades, categories) and
`src/lib/statuses.ts` (project status + derivations).

**Screens.** Company/app settings (name, timezone, currency, logo) · Notification settings ·
SMTP test panel. (No lookup-list managers.)

**Rules.**
- Changing currency/timezone is a guarded action (affects display across the app).
- Adding a unit/trade/category/status is a code change (one-line const edit, no migration), not a
  runtime admin action — by design.

**Events.** `settings.updated` (optional audit only).

**Permissions.** `settings.view`, `settings.manage` (Admin).

**Done when.** An admin updates the firm's timezone and it takes effect across displayed
timestamps; the settings hub exposes app/company + notification settings only (no option-list
CRUD).

---

### 5.4 Notifications / Email Updates
> Specified in depth in [08-notifications.md](08-notifications.md); summarized here for scope.

**Purpose.** SMTP email (and optional in-app) alerts for critical events.

**Key data.** `notifications`, `notification_settings`.

**Screens.** Notification settings (per-event toggle, recipients rule, digest vs immediate) ·
In-app bell/inbox · SMTP test.

**Rules.** Event-driven; per-event enable/disable; recipient resolution by role + project
assignment; retries on SMTP failure; email failure never breaks the source action; every send
recorded.

**Events (consumes).** `material_request.*`, `task.delayed`, `stock.low`, `dsr.submitted`,
`approval.pending`, `phase.critical_update`, etc.

**Permissions.** `notification.settings.manage` (Admin).

**Done when.** Approving an MR emails the requester via SMTP, the send is recorded, and a
failed send is retried and surfaced — without rolling back the approval.

---

## Directory

### 5.5 Employee / Workforce Directory
**Purpose.** Reference list of people in project operations (who reported/received/worked).

**Key data.** `employees` (trade via the fixed `trade_code`, `src/lib/lookups.ts`).

**Screens.** Employee list (search/filter by trade/status) · Create/edit · Employee detail
(appearances in DSR manpower, receipts).

**Rules.** Soft-delete; an employee referenced by reports/receipts cannot be hard-deleted.
Optional link to a `users` account.

**Permissions.** `employee.view`, `employee.manage` (Admin).

**Done when.** An employee can be created, picked in a DSR's manpower list, and their site
appearances are visible on their detail page.

---

### 5.6 Clients
**Purpose.** Client records with contacts, documents, notes, and project history.

**Key data.** `clients`; documents/notes via the polymorphic `attachments`/`notes` tables ([17](17-audit-decisions.md) §1); derived projects.

**Screens.** Client list · Create/edit · Client detail (tabs: Info, Documents, Notes, Projects).

**Rules.** Soft-delete; client with projects can't be hard-deleted. Project history is derived,
not stored.

**Permissions.** `client.view`, `client.manage` (Admin).

**Done when.** Creating a project for a client makes that project appear under the client's
Projects tab.

---

### 5.7 Suppliers / Vendors
**Purpose.** Suppliers used in stock-in and expenses.

**Key data.** `suppliers`.

**Screens.** Supplier list · Create/edit · Supplier detail (linked stock-ins and expenses).

**Rules.** Soft-delete; referenced suppliers can't be hard-deleted.

**Permissions.** `supplier.view`, `supplier.manage` (Admin).

**Done when.** A supplier can be chosen on a stock-in and an expense, and both appear on the
supplier's detail page.

---

## Projects

### 5.8 Project Management
**Purpose.** Create and monitor projects.

**Key data.** `projects`, `project_members` (the access grant); documents via the polymorphic `attachments` table ([17](17-audit-decisions.md) §1, §10.1).

**Screens.** Projects list (status, progress, client, engineer) · Create/edit · Project
detail hub (Overview, Phases/Tasks, Daily Reports, Budget, Expenses, Cash Flow, Materials,
Documents).

**Rules.**
- **Access is granted by `project_members`** (an engineer sees a project iff they're a member),
  enforced at the query level via `assertProjectAccess` + scope-baked reads ([17](17-audit-decisions.md)
  §10.1–10.2). Assign a **team** — one **lead** (site engineer) plus any number of **member**
  engineers — through the team picker, which writes `project_members` rows; `lead_engineer_id`
  only names the primary engineer for display. All members share the same scoped capabilities
  (the lead is a label, not a power level).
- `progress_pct` **rolls up from phases, recomputed on write** inside the task-update transaction;
  set `progress_is_manual` to pin a manual value and stop the roll-up ([17](17-audit-decisions.md) §10.3).
- Status transitions follow the fixed `projects.status` enum (`PLANNING`/`ACTIVE`/`ON_HOLD`/
  `COMPLETED`/`CANCELLED`, [17](17-audit-decisions.md) §9), validated by a pure state-machine
  function in the `project.update` handler; setting `COMPLETED` requires an `actual_end_date`.
  Warranty/retention is the derived `defects_liability_until`, not a status.
- Contract amount and budget are distinct (contract = client price; budget = planned cost).

**Events.** `project.created`, `project.status_changed`, `project.completed`.

**Permissions.** `project.create/update/delete`, `project.view.all` / `project.view.assigned`.

**Done when.** Admin creates a project, assigns a **team of engineers (lead + members)**, and
those engineers see it on their dashboard while unassigned engineers do not.

---

### 5.8a Project Templates — admin reference data

> **Built** alongside the Stage 2 review ([02](02-data-model.md) §4.6,
> [17](17-audit-decisions.md) §10.17). Admin-managed presets that seed a project's phase/task tree.

**Purpose.** Stop re-typing the same phase/task breakdown for every project. An admin authors a
reusable **template** (phases with a *duration in days*, tasks with a *weight*); creating a project
**from a template** clones the tree and computes a schedule.

**Key data.** `project_templates`, `project_template_phases` (`duration_days`),
`project_template_tasks` (`weight_pct`) — [02](02-data-model.md) §4.6.

**Screens.** Setup → **Templates** list · Create/edit template (phases with duration, tasks with
weight + the same "% unallocated" affordance as the task form) · the **"Start from template"**
picker + **review step** inside Create Project.

**Rules.**
- **Calendar-day chaining.** From one project start date, phase 1 starts on the project start and
  each next phase the day *after* the prior phase's computed end (`end = start + duration − 1`,
  inclusive). The result is shown in a **review step where per-phase durations are adjustable
  (validated ≥ 1) before any rows are written** — nothing hits the project until the user confirms.
- **Editable tasks at the review step.** Under each (fixed) phase the review seeds the template's
  tasks as a **fully editable list** — rename, reweight, remove, or add — so a phase that's already
  100%-allocated isn't a dead end. A phase's task weights may not exceed 100% (guarded client-side
  and in the service). The client sends the **full edited list per phase**, so the template's stored
  tasks aren't re-read at instantiation. Phases themselves are **not** addable/removable at review —
  the structure stays the template's (edit phases after the project exists).
- **Snapshot, not link.** Instantiation is a one-time copy; editing the project never touches the
  template and vice-versa. Tasks carry **no dates** (phase-level scheduling only, v1).
- **Atomic.** The shared `instantiateTemplate(tx, …)` service inserts the project's phases
  (`target_start_date`/`target_end_date` from the chain; actuals null; `progress_pct` 0) and their
  tasks (name + weight + sequence) in **one transaction** ([17](17-audit-decisions.md) §10.17).
- Two entry points share that service: **at creation** (the primary path) and **apply to an existing
  project that has zero phases** (an "Apply template" affordance on the empty Phases tab, guarded by
  `project.update`).

**Permissions.** `template.view`, `template.manage` (admin). Out of v1: "save project as template",
working-day/holiday calendars, task-level durations.

**Done when.** An admin authors a template; an admin creates a project from it, bumps a 7-day phase
to 9 days at the review step, confirms, and the project's phases carry the chained target dates with
tasks weighted and progress 0.

---

### 5.9 Project Phases & Tasks
**Purpose.** Break a project into Phases → Tasks to track progress, timeline, delays.

**Key data.** `phases`, `tasks`, task attachments via the polymorphic `attachments` table ([17](17-audit-decisions.md) §1).

**Screens.** Phase/task board or list inside the project (grouped by phase) · Create/edit
phase · Create/edit task · Task detail (status, dates, progress, remarks, attachments).

**Rules.**
- Hierarchy: Project → Phase → Task.
- **Assigned engineers create, edit, and assign tasks** on their project (`task.manage`, scoped
  via `assertProjectAccess` — [03](03-roles-and-permissions.md) §4.7); the named lead and member
  engineers have equal task authority, and admin oversees firm-wide. `task.update.progress`
  remains the narrower assignee quick-update path.
- `is_delayed` is a **stored transition flag**: the daily job flips it `false→true` for tasks
  newly past due (`due_date < today AND progress_pct < 100`), emits `task.delayed` once on that
  transition, and resets it when the task completes or the due date moves; the read path derives
  the same condition for live display only ([17](17-audit-decisions.md) §10.7).
- Phase progress = weighted/avg of its tasks; project progress rolls up from phases — **computed
  on write**, with `SELECT … FOR UPDATE` on the phase/project rows to avoid lost updates when two
  engineers edit one project ([17](17-audit-decisions.md) §10.3).
- Completing all tasks in a phase can auto-complete the phase (configurable).

**Events.** `task.delayed`, `phase.completed`, `phase.critical_update` (admin-flagged).

**Permissions.** `task.manage` (Admin + assigned Engineers, scoped), `task.update.progress`
(assignee quick-update). QA/QC has `task.view` only.

**Done when.** A task past its due date and not done shows as delayed, appears in the delayed-
tasks dashboard widget, and triggers one delay notification.

---

### 5.10 Daily Site Reports (DSR)
**Purpose.** Dated record of site activity: weather, work done, manpower, equipment, materials
used, photos, issues, next-day plan, progress.

**Key data.** `daily_reports` + `dsr_manpower` / `dsr_equipment` / `dsr_materials` /
`dsr_photos` / `dsr_issues`.

**Screens.** DSR list per project (by date) · Create/submit DSR (multi-section form) · DSR
detail (read view with photo gallery) · "My reports" for engineers.

**Rules.**
- One DSR per project per date (`UNIQUE(project_id, report_date)`), single `submitted_by`.
  **"New DSR" detects today's row up front** and routes to edit / resume / read-only — never let
  an engineer fill the whole form and then fail on the unique constraint ([17](17-audit-decisions.md) §10.5).
- `DRAFT` is editable by its author; `SUBMITTED` locks editing (re-open is an admin/logged action).
- **Resilience:** the server `DRAFT` is the source of truth (debounced autosave) with a
  localStorage write-through buffer that replays on reconnect; each photo **uploads on pick**
  (client-compressed → the R2 presign pipeline → attached to the draft), so the form holds only
  references and submit stays small ([17](17-audit-decisions.md) §10.6).
- `dsr_materials` rows linked to an `item_id` are the **usage** signal for inventory accounting.
  Stage 2 reserves the link (`source_id = dsr_materials.id`); the Stage-3 ledger posts the
  `−USAGE` rows and reverses the exact ones on re-open ([17](17-audit-decisions.md) §10.4,
  [06](06-inventory-ledger.md) §6).
- Photos go to object storage; enforce mime/size limits (the Stage-1 `files`/`attachments` pipeline).
- Submitting updates the project/phase progress note feed and emits `dsr.submitted`.

**Events.** `dsr.submitted`, `dsr.issue.flagged` (for high-severity issues).

**Permissions.** `dsr.create`, `dsr.update.own`, `dsr.view`/`dsr.view.all`.

**Done when.** An engineer submits a DSR with materials used; those quantities reduce remaining
material for the project and appear in the issued/used/remaining report.

---

### 5.10a Inspections (QA/QC) — implemented

> **Built.** Base request → pass/fail module shipped in Stage 2 (uncommitted at audit time);
> the **structured checklist + per-item photos + re-inspection history** enhancement is layered
> on top ([02](02-data-model.md) §4.5, [17](17-audit-decisions.md) §10.9–10.10, §10.16). Project-scoped,
> on its own **Inspections** tab — not bound to a task or phase.

**Purpose.** An engineer requests a QA/QC inspection; the QA/QC engineer runs a checklist (each
item PASS/FAIL/N-A + remarks + optional photos), sets the overall pass/fail, and — when it fails —
**re-inspects the same record in place**, with every recording kept as an attempt in the history.

**Key data.** `inspections`, `inspection_attempts` (the history log), `inspection_item_results`
(per-attempt snapshot), and the admin presets `inspection_checklists` / `inspection_checklist_items`
([02](02-data-model.md) §4.5). Per-item photos via the polymorphic `attachments` table
(`entity_type = 'inspection_item_result'`).

**Actors.** Engineer requests (`inspection.request`); QA/QC engineer records / re-inspects
(`inspection.record`); admins author the preset checklists (`checklist.manage`).

**Flow.**
- Engineer raises a request and **names the QA/QC engineer** (`inspector_id`) + what's inspected.
  On create the system (a) **notifies that QA/QC engineer** (`inspection.requested`) and (b) inserts
  a `project_members(role_on_project='INSPECTOR')` row so they can open the otherwise-scoped project
  ([17](17-audit-decisions.md) §10.12). No request → no membership → 404.
- The QA/QC engineer opens the inspection, **picks a preset checklist by category** (optional — no
  checklist = today's free-form pass/fail), marks each item **PASS / FAIL / N-A** (+remarks, +photos),
  then **sets the overall `PASSED` / `FAILED` themselves** (items are evidence, not an auto-gate).
  Recording appends an `inspection_attempts` row (with its snapshotted `inspection_item_results`),
  sets the inspection's latest `status`/`outcome_remarks`, and fires `inspection.completed` to the
  requester.
- **Re-inspection = reopen in place** ([17](17-audit-decisions.md) §10.16): a FAILED inspection is
  re-inspected on the **same** record — the outcome dialog pre-fills from the last attempt (passed
  items carry forward, editable), and a fresh attempt is appended. No new request, no new record;
  the history shows the full attempt timeline.
- The requester (or an admin) may **withdraw** a request that's still `REQUESTED` (soft-delete).

**Events.** `inspection.requested` (→ the named QA/QC engineer), `inspection.completed` (→ the
requester) — [08](08-notifications.md).

**Permissions.** `inspection.view`, `inspection.request` (Engineer, scoped), `inspection.record`
(QA/QC, scoped); `checklist.view` / `checklist.manage` for the preset library (admin).

**Done when.** An engineer requests an inspection; the named QA/QC engineer is notified, opens the
project, runs a checklist, records FAILED with a flagged item + photo, then re-inspects the same
record to PASSED — and the inspection shows a two-attempt history.

---

## Finance — full detail in [07-finance-design.md](07-finance-design.md)

### 5.11 Budget & Expenses
**Purpose.** Planned budget vs. actual expenses per project.

**Key data.** `budgets`, `budget_lines`, `expenses`; receipts via the polymorphic `attachments` table ([17](17-audit-decisions.md) §1).

**Screens.** Project Budget (categorized lines, total) · Budget revision · Expenses list
(filter by category/status/date) · Create expense (with receipt upload) · Expense approval
queue.

**Rules.**
- Only **APPROVED** expenses count as actual cost (pending/rejected excluded from budget-vs-
  actual).
- An expense may link to a `budget_line` to compare actual vs planned per category.
- Expense creation triggers an approval ([5.12](#512-approvals)); approval flips status and
  records `approved_by`.
- Money math per [07](07-finance-design.md) (integer/decimal, never float).
- Budget revision creates a new `version`, supersedes the prior, and is itself an approvable
  `BUDGET_ADJUSTMENT`.

**Events.** `expense.submitted`, `expense.approved`, `expense.rejected`, `budget.exceeded`
(actual > budget threshold).

**Permissions.** `budget.manage`, `expense.create`, `expense.approve`.

**Done when.** Submitting an expense creates a pending approval; once approved it appears in
budget-vs-actual and updates the project's actual cost and dashboard.

---

### 5.12 Cash Flow
**Purpose.** Track money in (client payments, billings) and out (suppliers, rentals,
subcontractors).

**Key data.** `cashflow_tx` (category via the fixed `category_code`, `src/lib/lookups.ts`).

**Screens.** Cash flow ledger per project (and firm-wide) · Add inflow/outflow · Cash position
summary (in − out, running balance).

**Rules.**
- `direction` (IN/OUT) + positive `amount`; never store signed amounts.
- Optional link to project, client, or supplier.
- Cash position = Σ(IN) − Σ(OUT) for the scope; running balance ordered by `tx_date`.
- Cash flow is **separate** from expenses: an expense is a cost; a cash OUT is a payment. They
  may relate but are tracked independently to keep the model honest. (Document the firm's
  convention if they want them linked.)

**Events.** `cashflow.recorded` (audit/optional).

**Permissions.** `cashflow.view`, `cashflow.manage` (Admin).

**Done when.** Recording a client payment (IN) and a supplier payment (OUT) updates the
project's cash position and the cash-flow report.

---

### 5.13 Approvals
**Purpose.** Gate critical transactions: material requests, expenses, budget adjustments,
inventory adjustments, damaged items, lost/missing materials.

**Key data.** `approvals` (polymorphic, [02](02-data-model.md) §6).

**Screens.** Unified Approvals inbox (filter by type/status) · Approval detail with the subject
embedded and Approve/Reject (+ note) actions.

**Rules.**
- State machine: `PENDING → APPROVED | REJECTED`; `PENDING → CANCELLED` by requester.
- The **effect** of the transaction happens only on approval (stock isn't released, expense
  isn't counted, adjustment isn't posted until then), inside one transaction.
- Reject requires a `decision_note`.
- Approver ≠ requester is enforceable (configurable for small teams).
- Approving/rejecting emits a notification to the requester and writes audit + (if applicable)
  ledger rows atomically.

**Events.** `approval.pending` (to approvers), `approval.decided` (to requester).

**Permissions.** `approval.view`, `approval.decide` (Admin).

**Done when.** One inbox shows all pending items across types; approving a material-request
approval releases nothing by itself but unlocks the release step, while approving an inventory
adjustment posts the ledger movement.

Full state machine: [05-core-flows.md](05-core-flows.md) §5.

---

## Inventory — full detail in [06-inventory-ledger.md](06-inventory-ledger.md)

### 5.14 Inventory Master Data
**Purpose.** Items and locations.

**Key data.** `items`, `locations` (category/unit via the fixed `category_code`/`unit_code`,
`src/lib/lookups.ts`).

**Screens.** Items list (category, unit, on-hand, reorder level) · Create/edit item ·
Locations list/edit.

**Rules.** Soft-delete items; referenced items deactivate, not delete. `reorder_level` drives
low-stock detection. A `SITE` location may link to a project. On-hand is read from
`item_stock_balances`, never typed by hand (except via an audited adjustment).

**Events.** none directly (low-stock is detected on balance change / by job).

**Permissions.** `item.manage`, `location.manage` (Admin); `item.view` broader.

**Done when.** Creating an item with a reorder level makes it eligible for low-stock alerts and
selectable across stock-in/requests.

---

### 5.15 Inventory Stock-In
**Purpose.** Record materials received into inventory.

**Key data.** `stock_ins`, `stock_in_lines`, → `stock_ledger`.

**Screens.** Stock-in list · New stock-in (supplier, location, received-by, date, invoice
upload, line items with qty + unit cost) · Stock-in detail.

**Rules.**
- Posting writes one **positive** `STOCK_IN` ledger row per line and bumps
  `item_stock_balances` for the receiving location — atomically.
- `unit_cost` snapshots onto the ledger for valuation.
- Crossing back **above** reorder level can clear a low-stock flag.

**Events.** `stockin.recorded`.

**Permissions.** `stockin.create` (Admin).

**Done when.** Recording a stock-in raises the item's on-hand at the chosen location and shows
in the item ledger with the supplier and cost.

---

### 5.16 Material Requests (MR)
**Purpose.** Engineers request materials for a project.

**Key data.** `material_requests`, `mr_lines`, `approvals`.

**Screens.** MR list (status) · New MR (project, needed date, purpose, line items) · MR detail
(approval state, released qty per line) · Approval view (admin).

**Rules.**
- Engineer creates MR for an assigned project → status `PENDING` with an `approvals` row.
- Admin approves/rejects; on approval, `qty_approved` is set (may differ from requested) and
  status enables release.
- Partial release supported: status moves `APPROVED → PARTIALLY_RELEASED → RELEASED` as
  `qty_released` accrues.
- An MR does not move stock; **release** does.

**Events.** `material_request.submitted` (→ approvers), `material_request.approved` /
`.rejected` / `.released` (→ requester), `stock.low` may fire downstream.

**Permissions.** `mr.create` (Engineer/Admin), `mr.approve` (Admin).

**Done when.** An engineer submits an MR, admin approves it, and it becomes available for
release with the approved quantities.

---

### 5.17 Inventory Release & Site Receiving
**Purpose.** Issue approved materials and confirm what actually arrived on site.

**Key data.** `releases`, `release_lines`, `site_receipts`, `site_receipt_lines`, →
`stock_ledger`.

**Screens.** Release form (against an approved MR; pick source location + qty per line) ·
Release detail · Site receiving form (engineer confirms received qty, flags shortage/damage,
uploads proof) · Discrepancy view.

**Rules.**
- Release requires sufficient on-hand at the source; posts **negative** `RELEASE` ledger rows
  and decrements balances atomically. Updates `mr_lines.qty_released`.
- Site receiving posts a **positive** `RECEIPT` ledger row at the site location (if sites are
  tracked) and records shortages (`released − received`). A shortage opens a discrepancy and may
  spawn a `LOSS`/`DAMAGE` movement requiring approval.
- Proof attachments stored in object storage.

**Events.** `release.created`, `receiving.confirmed`, `receiving.discrepancy`.

**Permissions.** `release.create` (Admin), `receiving.confirm` (Engineer/Admin at their site).

**Done when.** Releasing against an approved MR lowers warehouse on-hand; the engineer confirms
receipt with a shortage, and the shortage is visible as a discrepancy and reflected in
issued/received figures.

---

### 5.18 Inventory Movements & Adjustments
**Purpose.** Returns, transfers, damaged, wasted, lost/missing, and manual adjustments.

**Key data.** `inventory_movements`, `approvals`, → `stock_ledger`.

**Screens.** Movement list (by type/status) · New movement (type-specific form) · Adjustment
form (with mandatory reason) · Approval view for damage/waste/loss/adjustment.

**Rules.**
- **Return:** site → warehouse; positive at destination, negative at source.
- **Transfer:** location → location; `TRANSFER_OUT` (−) and `TRANSFER_IN` (+) as a pair.
- **Damage / Waste / Loss:** negative at source; **require approval** before posting; reason +
  proof mandatory.
- **Adjustment:** manual correction to match a physical count; **requires approval**; reason
  mandatory; posts a signed `ADJUSTMENT` row equal to (counted − system).
- Approval-gated types stay `PENDING` and post to the ledger only on approval.

**Events.** `movement.created`, `movement.pending` (→ approvers), `movement.posted`.

**Permissions.** `movement.create`, `movement.approve` (Admin).

**Done when.** A damaged-materials movement waits for approval, and only upon approval reduces
on-hand and appears in the ledger and the damaged/lost report.

---

### 5.19 Inventory Traceability / Ledger
**Purpose.** Full movement history for any item — who requested, approved, released, received,
used, returned, transferred, damaged, wasted, lost.

**Key data.** `stock_ledger` (read), joined to source records and actors.

**Screens.** Item ledger (chronological, signed quantities, running balance, actor, source
link) · Project material trail · Global movement search (by item, location, date, type, person).

**Rules.**
- Pure read over the append-only ledger; never mutated here.
- Every row deep-links to its source (stock-in, release, DSR, movement) and its actor.
- Running balance computed in query order.

**Events.** none.

**Permissions.** `ledger.view`.

**Done when.** Selecting an item shows every movement with the responsible person and a link to
the originating document, and the running balance matches current on-hand.

Full design: [06-inventory-ledger.md](06-inventory-ledger.md).

---

## Management Output

### 5.20 Reports & Export
**Purpose.** Management reports with filters and PDF/Excel/CSV export.

**Key data.** Read queries/views over operational tables.

**Reports.** Project progress · Daily site report · Budget vs actual · Expense · Cash flow ·
Inventory movement · Issued vs used vs remaining · Project used materials · Low stock ·
Damaged/lost materials · Timeline delay · Employee activity.

**Rules.** Read-only; respect role scope (engineers → their projects only); consistent filter
bar (date range, project, category…); export preserves the filtered result; large exports
stream/paginate.

**Permissions.** `report.view`, `report.export` (scoped for engineers).

**Done when.** Each report renders with filters and exports to PDF, Excel, and CSV matching the
on-screen data.

Full catalog & query strategy: [09-reports-and-export.md](09-reports-and-export.md).

---

### 5.21 Dashboard
**Purpose.** At-a-glance summary cards and tables.

**Key data.** Aggregations across projects, tasks, approvals, finance, inventory.

**Widgets.** Active projects · Delayed tasks · Pending approvals · Budget usage · Total
expenses · Cash position · Low-stock items · Recent daily reports · Recent inventory movements.

**Rules.** Role-aware (admin = firm-wide; engineer = assigned projects); each widget deep-links
to its source list; computed from read queries (cached where heavy).

**Permissions.** `dashboard.admin` / `dashboard.engineer`.

**Done when.** Admin sees firm-wide cards that match the underlying reports; an engineer sees
only their projects' figures.

Full design: [10-dashboard.md](10-dashboard.md).

---

## Module → Stage map

| Stage ([14](14-implementation-roadmap.md)) | Modules |
|-------|---------|
| 1 — Setup & Core | 5.1, 5.2, 5.3, 5.4 (scaffold), 5.5, 5.6, 5.7 |
| 2 — Project Tracking | 5.8, **5.8a Templates**, 5.9, 5.10, **5.10a Inspections** (+ checklist/history enhancement), + project notifications; `QA_QC_ENGINEER` role + scoping |
| 3 — Inventory | 5.14, 5.15, 5.16, 5.17, 5.18, 5.19 |
| 4 — Financial | 5.11, 5.12, 5.13 |
| 5 — Output | 5.20, 5.21, full 5.4 wiring, testing, polish |

# 03 — Roles & Permissions (RBAC)

## 1. Model

Three roles ship visibly — `ADMIN`, `ENGINEER`, `QA_QC_ENGINEER` — plus the hidden `WEBMASTER`
superuser, but access is expressed as **permissions** so finer roles can be added later without
rewriting logic.

- **Role** → a named bundle (`ADMIN`, `ENGINEER`, `QA_QC_ENGINEER`).
- **Permission** → a single capability key (`expense.approve`, `project.create`).
- A user has one role; a role grants a set of permissions.

The permission keys are the stable contract; the role→permission mapping is just the default
bundle. `QA_QC_ENGINEER` is the first proof of the "add a role from existing keys" path: when
the firm later needs a "Warehouse Keeper" or "Accountant," you create a new role and assign
existing permission keys — no code changes in the guards.

> **Roles the client names that are _not_ new roles.** "GM / OM" (General / Operations Manager)
> map to **`ADMIN`** — they create projects and tasks with full firm-wide access. "Purchasing"
> is **not a role**: it's the Material Request flow ([04](04-modules.md) §5.16, Stage 3) where
> engineers raise requests and Admin approves.

> **Two enforcement layers, both required.** The UI hides what a user can't do (good UX), and
> the **server re-checks every request** (real security). Never trust the client. Engineers
> are additionally **scoped to their assigned projects in the query itself**, not just by
> hiding buttons.

## 2. Permission keys

Grouped by area. `*` is shorthand for all actions in a group.

| Area | Keys |
|------|------|
| Users | `user.view` `user.create` `user.update` `user.deactivate` |
| Settings | `settings.view` `settings.manage` |
| Audit | `audit.view` |
| Employees | `employee.view` `employee.manage` |
| Clients | `client.view` `client.manage` |
| Suppliers | `supplier.view` `supplier.manage` |
| Projects | `project.view.all` `project.view.assigned` `project.create` `project.update` `project.delete` |
| Phases/Tasks | `task.view` `task.manage` `task.update.progress` |
| Daily Reports | `dsr.view` `dsr.create` `dsr.update.own` `dsr.view.all` |
| Inspections _(reserved; module ships post-Stage-2 — [04](04-modules.md) §5.10a)_ | `inspection.request` `inspection.view.assigned` `inspection.view.all` `inspection.record` |
| Budget | `budget.view` `budget.manage` `budget.adjust` |
| Expenses | `expense.view` `expense.create` `expense.approve` |
| Cash Flow | `cashflow.view` `cashflow.manage` |
| Approvals | `approval.view` `approval.decide` |
| Inventory master | `item.view` `item.manage` `location.manage` |
| Stock-In | `stockin.view` `stockin.create` |
| Material Requests | `mr.view.assigned` `mr.view.all` `mr.create` `mr.approve` |
| Release/Receiving | `release.create` `receiving.confirm` |
| Movements | `movement.create` `movement.approve` |
| Ledger | `ledger.view` |
| Reports | `report.view` `report.export` |
| Dashboard | `dashboard.admin` `dashboard.engineer` |
| Notifications | `notification.settings.manage` |

## 3. Permission matrix (v1 defaults)

✅ granted · — not granted · 🔶 scoped to assigned projects / own records

| Capability | Admin | Engineer | QA/QC Eng |
|------------|:-----:|:--------:|:---------:|
| Manage users | ✅ | — | — |
| Manage system settings | ✅ | — | — |
| View audit trail | ✅ | — | — |
| Manage employees / clients / suppliers | ✅ | — | — |
| View all projects | ✅ | — | — |
| View assigned projects | ✅ | 🔶 | 🔶 granted on inspection request |
| Create / edit / delete projects | ✅ | — | — |
| View phases & tasks | ✅ | 🔶 assigned | 🔶 assigned |
| Create / assign / edit tasks (`task.manage`) | ✅ | 🔶 assigned projects | — |
| Update task progress (`task.update.progress`) | ✅ | 🔶 assigned | — |
| Request inspection (`inspection.request`) | ✅ | 🔶 assigned project/task | — |
| Record inspection result (`inspection.record`) | ✅ | — | 🔶 assigned |
| View inspections | ✅ | 🔶 own requests | 🔶 assigned |
| Create daily site reports | ✅ | 🔶 own assigned projects | — |
| View all daily reports | ✅ | 🔶 assigned only | — |
| Manage budgets | ✅ | — | — |
| Create expenses | ✅ | 🔶 (optional — see note) | — |
| Approve expenses | ✅ | — | — |
| Manage cash flow | ✅ | — | — |
| Decide approvals | ✅ | — | — |
| Manage inventory master data | ✅ | — | — |
| Record stock-in | ✅ | — | — |
| Create material requests | ✅ | 🔶 for assigned projects | — |
| Approve material requests | ✅ | — | — |
| Record release | ✅ | — | — |
| Confirm site receiving | ✅ | 🔶 receiving at their site | — |
| Create movements (return/transfer/damage/…) | ✅ | 🔶 return/damage/loss from their site | — |
| Approve movements | ✅ | — | — |
| View inventory ledger | ✅ | 🔶 items relevant to their projects | — |
| View reports | ✅ | 🔶 their projects only | — |
| Export reports | ✅ | 🔶 their projects only | — |
| Admin dashboard | ✅ | — | — |
| Engineer dashboard | — | ✅ | ✅ |

> **Inspection rows are reserved.** The QA/QC inspection *module* ships post-Stage-2
> ([04](04-modules.md) §5.10a, [17](17-audit-decisions.md) §10); the `QA_QC_ENGINEER` role and
> its project-scoping land in **Stage 2** so the keys have a home. Note the split of the old
> "Manage phases & tasks" row: engineers now **create/assign tasks** on assigned projects
> (`task.manage`, scoped), not just update progress.

> **Note on engineer-created expenses:** the proposal says "user submits expense." If
> engineers may submit expenses, give them `expense.create` (scoped to assigned projects);
> approval still belongs to Admin only. Decide this with the client; the matrix above marks it
> optional.

## 4. Scoping rules (the part that's easy to get wrong)

These are enforced in the data-access layer, applied to **every** query an engineer makes:

1. **Project scope.** An engineer sees a project only if they appear in `project_members` for it
   (the access grant — [17](17-audit-decisions.md) §10.1); `lead_engineer_id` merely names the
   lead. Enforced by one `assertProjectAccess(ctx, projectId)` on writes and membership-baked read
   queries — every list/detail/report query is filtered by that project set, and a guessed id
   returns 404, not data ([17](17-audit-decisions.md) §10.2).
2. **Report scope.** Engineer report queries are constrained to their project set before
   aggregation — they can never see firm-wide totals.
3. **Daily report ownership.** Engineers edit a DSR only while it is `DRAFT` and `submitted_by
   = user.id`. After `SUBMITTED`, edits require admin or a re-open action (logged).
4. **Material request scope.** Engineers create/view MRs only for assigned projects; they
   cannot approve.
5. **Inventory writes.** Engineers do not release stock or record stock-in. They can confirm
   receiving at their own site and raise returns/damage/loss from it (which then go to
   approval). Posting to the ledger for adjustments is admin-gated.
6. **Finance reads.** Engineers may see budget-vs-actual for their own projects (configurable)
   but never cash flow or firm-wide finance.
7. **Engineer task management is project-scoped.** `task.manage` (create/assign/edit phases &
   tasks) runs through the same `assertProjectAccess(ctx, projectId)` guard on the resolved
   project, so an engineer can only manage tasks on projects they are a member of. The full
   project team (lead + members, [02](02-data-model.md) §4.1) shares this capability equally —
   `role_on_project` does not change *what* a member can do, only display and notification
   targeting.
8. **QA/QC project scope — granted on request.** A `QA_QC_ENGINEER` sees a project only once an
   inspection request has added them to `project_members` as `role_on_project = 'INSPECTOR'`
   ([17](17-audit-decisions.md) §10); the same membership predicate and 404-on-guess apply —
   there is **no** firm-wide project visibility for QA/QC. Membership grants *scope*, never
   *capability*: an INSPECTOR can view tasks and view/record inspections, but never manage
   tasks, create DSRs, or touch finance/inventory.

## 5. Implementation guidance

- Define permission keys in one place (`lib/rbac.ts`) as constants.
- A `requirePermission(user, key)` guard runs in route handlers/server actions before any
  work. A `scopeProjects(user, query)` helper injects the engineer's project filter.
- Authorization failures return `403` and are not silently swallowed; sensitive denials may be
  audit-logged.
- Write **tests** for the matrix: for each permission key, assert Admin passes and Engineer is
  allowed/denied per the table. This is the cheapest insurance against access regressions.
- The first admin user is created by the seed script ([14](14-implementation-roadmap.md)
  Stage 1); there is no public sign-up.

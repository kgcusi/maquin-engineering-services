# 03 — Roles & Permissions (RBAC)

## 1. Model

Two roles ship in v1, but access is expressed as **permissions** so finer roles can be added
later without rewriting logic.

- **Role** → a named bundle (`ADMIN`, `ENGINEER`).
- **Permission** → a single capability key (`expense.approve`, `project.create`).
- A user has one role; a role grants a set of permissions.

The permission keys are the stable contract. The two-role mapping is just the v1 default
bundle. When the firm later needs a "Warehouse Keeper" or "Accountant," you create a new
role and assign existing permission keys — no code changes in the guards.

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

| Capability | Admin | Engineer |
|------------|:-----:|:--------:|
| Manage users | ✅ | — |
| Manage system settings | ✅ | — |
| View audit trail | ✅ | — |
| Manage employees / clients / suppliers | ✅ | — |
| View all projects | ✅ | — |
| View assigned projects | ✅ | 🔶 |
| Create / edit / delete projects | ✅ | — |
| Manage phases & tasks | ✅ | 🔶 update progress on assigned |
| Create daily site reports | ✅ | 🔶 own assigned projects |
| View all daily reports | ✅ | 🔶 assigned only |
| Manage budgets | ✅ | — |
| Create expenses | ✅ | 🔶 (optional — see note) |
| Approve expenses | ✅ | — |
| Manage cash flow | ✅ | — |
| Decide approvals | ✅ | — |
| Manage inventory master data | ✅ | — |
| Record stock-in | ✅ | — |
| Create material requests | ✅ | 🔶 for assigned projects |
| Approve material requests | ✅ | — |
| Record release | ✅ | — |
| Confirm site receiving | ✅ | 🔶 receiving at their site |
| Create movements (return/transfer/damage/…) | ✅ | 🔶 return/damage/loss from their site |
| Approve movements | ✅ | — |
| View inventory ledger | ✅ | 🔶 items relevant to their projects |
| View reports | ✅ | 🔶 their projects only |
| Export reports | ✅ | 🔶 their projects only |
| Admin dashboard | ✅ | — |
| Engineer dashboard | — | ✅ |

> **Note on engineer-created expenses:** the proposal says "user submits expense." If
> engineers may submit expenses, give them `expense.create` (scoped to assigned projects);
> approval still belongs to Admin only. Decide this with the client; the matrix above marks it
> optional.

## 4. Scoping rules (the part that's easy to get wrong)

These are enforced in the data-access layer, applied to **every** query an engineer makes:

1. **Project scope.** An engineer sees a project only if `lead_engineer_id = user.id` (or they
   appear in `project_members`). Every list/detail/report query for engineers is filtered by
   this set of project ids.
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

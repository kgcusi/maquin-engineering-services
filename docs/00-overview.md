# 00 — Overview & Glossary

## 1. Vision

A single internal system where management can answer, at any moment:

- **Where do our projects stand?** Progress, delays, what happened on site today.
- **Where are our materials?** From the moment stock arrives to the moment it is used,
  returned, transferred, damaged, wasted, or lost — with a name attached to every step.
- **Where is our money going?** Budgeted vs. actual cost per project, and the cash
  position (money in vs. money out).
- **What needs my attention?** Pending approvals, delayed tasks, low stock, new reports.

The system is **operational, not just record-keeping**. Its value comes from accountability:
every meaningful action is attributable to a person and a time, and critical events push a
notification to the right person.

## 2. Primary outcomes

1. One place to monitor active and completed projects.
2. A reliable, queryable material trail (the inventory ledger is the heart of the system).
3. Budget / expense / cash-flow visibility per project.
4. Email notifications for critical events via SMTP.
5. Management reports with PDF / Excel / CSV export.
6. An audit trail that makes the system trustworthy.

## 3. Personas

### Admin / Management
The power user. Manages users, master data, clients, suppliers, projects, the full
inventory lifecycle, budgets, expenses, cash flow, approvals, notification settings, reports,
the dashboard, and audit logs. Approves requests and expenses. Sees everything across all
projects.

**Mental model:** "I oversee the whole operation and sign off on what matters."

### Engineer / Project-in-Charge
The field user. Sees only the projects assigned to them. Updates progress, submits daily
site reports (manpower, equipment, materials used, photos, issues), records materials used,
and raises material requests. Cannot approve, cannot see other engineers' projects, cannot
manage master data.

**Mental model:** "I run my sites, report what happened, and ask for what I need."

> The role model is intentionally simple (two roles) but built on a **permission layer** so
> finer roles (e.g. Purchaser, Warehouse Keeper, Accountant) can be added later without
> rewriting access logic. See [03-roles-and-permissions.md](03-roles-and-permissions.md).

## 4. Scope summary

| Area | Modules |
|------|---------|
| Core System | User & Authentication · Audit Trail · System Settings · Notifications / Email |
| Directory | Employee / Workforce Directory · Clients · Suppliers / Vendors |
| Projects | Project Management · Phases & Tasks · Daily Site Reports |
| Finance | Budget & Expenses · Cash Flow · Approvals |
| Inventory | Master Data · Stock-In · Material Requests · Release & Site Receiving · Movements & Adjustments · Traceability / Ledger |
| Management Output | Reports & Export · Dashboard |

Full specs in [04-modules.md](04-modules.md).

## 5. Explicitly out of scope (v1)

To keep the first release shippable, these are **not** in v1 (candidates for later — see
[15-future-enhancements.md](15-future-enhancements.md)):

- Mobile native apps (the web app is responsive and works on phones/tablets).
- Accounting-system integration (QuickBooks/Xero) — finance here is project-level tracking,
  not bookkeeping.
- Purchase orders and a full procurement workflow (stock-in is recorded directly).
- Gantt chart scheduling with dependencies (phases/tasks track dates and status, not a
  critical-path engine).
- Real-time chat / in-app messaging.
- Client-facing or supplier-facing portals (internal users only).
- Barcode / QR scanning hardware integration.
- Multi-currency (single base currency assumed).

## 6. Glossary

| Term | Meaning |
|------|---------|
| **Project** | A construction/engineering job for a client. Top of the work hierarchy. |
| **Phase** | A major stage of a project (e.g. Site Prep, Foundation, Structure). |
| **Task** | A unit of work inside a phase, with status, dates, and progress. |
| **Daily Site Report (DSR)** | A dated record of what happened on a project site on one day. |
| **Item** | An inventory master record (a material/product the firm stocks). |
| **Location** | A physical place stock lives (warehouse, yard, a project site). |
| **Stock-In** | Receiving material into inventory. |
| **Material Request (MR)** | An engineer's request for items for a project. |
| **Release** | Issuing requested material out of a location toward a site. |
| **Site Receiving** | Confirming what actually arrived at the site (may differ from released). |
| **Movement** | Any event that changes stock: in, release, return, transfer, damage, waste, loss, adjustment, usage. |
| **Ledger** | The append-only log of every movement — the source of truth for stock. |
| **Balance** | Current quantity of an item at a location, derived from the ledger. |
| **Issued vs Used vs Remaining** | Issued = released to a site; Used = consumed (from DSRs); Remaining = issued − used − returned. |
| **Budget** | Planned cost for a project, broken into budget categories/lines. |
| **Expense** | An actual cost incurred against a project. |
| **Cash Flow** | Money in (client payments) and money out (supplier/subcontractor/rental payments). |
| **Approval** | A gate that holds a transaction until an authorized user accepts/rejects it. |
| **Audit Log** | An immutable record of who did what, when. |
| **RBAC** | Role-Based Access Control. |
| **SMTP** | The email-sending protocol used for notifications. |

## 7. Naming & convention rules (apply everywhere)

These keep the codebase and database consistent. The build must follow them.

- **Database:** `snake_case` table and column names, **plural** table names (`material_requests`).
  Primary keys are `id`. Foreign keys are `<entity>_id` (`project_id`). Timestamps are
  `created_at`, `updated_at`. Soft-delete uses `deleted_at` (nullable) where applicable.
- **Money:** stored as integer **minor units** (e.g. centavos) or `DECIMAL(14,2)` — never
  floats. See [07-finance-design.md](07-finance-design.md).
- **Quantities:** `DECIMAL(14,3)` to allow fractional units (e.g. 2.5 m³).
- **Fixed values are code-owned (not lookup tables).** Statuses, categories, units, and trades
  are **fixed in code**, split by nature (see [17-audit-decisions.md](17-audit-decisions.md) §9):
  state machines code branches on (project status, approvals, …) are Postgres **`pgEnum`**;
  descriptive labels (units, trades, categories) are **TS const maps + a `text` code column** in
  `src/lib/lookups.ts`; task/phase status is **derived** from progress, not stored. Only
  `app_settings` (timezone, currency, company) and `notification_settings` stay admin-editable.
- **IDs to humans:** every transactional record also gets a human-readable reference code,
  e.g. `MR-2026-00042`, `SI-2026-00118`, `EXP-2026-00301`. Generated server-side, never
  reused.
- **Time:** store all timestamps in **UTC**; render in the firm's local timezone.
- **Code style:** `camelCase` in TypeScript, `PascalCase` for components/types. API routes are
  kebab-case plural resources (`/api/material-requests`).

## 8. Cross-cutting principles

1. **The ledger is immutable.** You never edit or delete a stock movement; you post a
   reversing movement. This is what makes traceability trustworthy.
2. **Approvals gate state changes, not records.** A pending request exists; its *effect*
   (releasing stock, committing an expense) only happens on approval.
3. **Everything attributable.** Every transactional row carries `created_by` and, where
   relevant, `approved_by`, `released_by`, `received_by`.
4. **Notifications are events, not side effects.** Domain actions emit events; a notification
   dispatcher decides what to send based on settings. See [08-notifications.md](08-notifications.md).
5. **Reports read, never write.** Reporting uses read-optimized queries/views and never
   mutates operational data.

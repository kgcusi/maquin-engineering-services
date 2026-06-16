# 10 — Dashboard

## 1. Purpose

The landing screen after login: an at-a-glance answer to "what's the state of the operation,
and what needs me?" Role-aware — admins see firm-wide, engineers see their assigned projects.

## 2. Widgets

| Widget | Shows | Source | Deep-links to |
|--------|-------|--------|---------------|
| **Active projects** | Count + list of in-progress projects with % progress | projects, tasks | Projects list |
| **Delayed tasks** | Count + worst-offenders (days late) | tasks (`is_delayed`) | Timeline delay report |
| **Pending approvals** | Count by type, oldest first | approvals (PENDING) | Approvals inbox |
| **Budget usage** | Planned vs actual %, per active project or aggregate | budgets, expenses | Budget vs actual |
| **Total expenses** | Approved expenses (period) | expenses (APPROVED) | Expense report |
| **Cash position** | Σ IN − Σ OUT, trend | cashflow_tx | Cash flow report |
| **Low-stock items** | Items ≤ reorder level | item_stock_balances, items | Low-stock report |
| **Recent daily reports** | Latest DSRs across projects | daily_reports | DSR list |
| **Recent inventory movements** | Latest ledger entries | stock_ledger | Inventory ledger |

## 3. Role differences

| | Admin | Engineer |
|--|------|----------|
| Scope | Firm-wide, all projects | Assigned projects only |
| Approvals widget | All pending (can decide) | Their submitted requests' status |
| Finance widgets | Full (budget, expenses, cash) | Budget usage for own projects (config); no cash position |
| Inventory widgets | Low stock, all movements | Movements/low-stock relevant to their sites |
| Primary CTA | Review approvals | Submit today's DSR |

Engineer scoping is applied at the **query** level, identical to reports
([03](03-roles-and-permissions.md) §4).

## 4. Layout guidance

- A compact **summary row** of KPI cards (active projects, delayed tasks, pending approvals,
  cash position) at the top — each a single number with a sparkline/delta and a click-through.
- Below, **two columns**: left = attention queues (approvals, delayed tasks, low stock); right =
  activity feeds (recent DSRs, recent movements).
- Avoid the generic three-equal-cards hero. Drive layout by **what needs action** (queues
  first), not by symmetry — see the design rules in the project conventions.
- Each card has a designed **empty state** ("No pending approvals — you're clear") and a
  **loading skeleton**, not bare "No data."

## 5. Data & performance

- Each widget = one read query; none mutate.
- Aggregations reuse the report queries/views ([09](09-reports-and-export.md)) so the dashboard
  and reports never disagree.
- Cache heavier aggregates (budget usage, cash position) for a short TTL with a manual refresh;
  cheap counts can be live.
- Load widgets independently (stream/async) so one slow query doesn't block the whole page.
- All numbers click through to the underlying filtered list/report — the dashboard is a launch
  pad, not a dead end.

## 6. Acceptance criteria

- Admin dashboard figures match the corresponding reports for the same period.
- An engineer sees only their projects' data in every widget.
- Every KPI/card deep-links to its source view.
- Empty, loading, and error states are designed (no raw "No data" / spinners-only).

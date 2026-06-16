# 09 — Reports & Export

## 1. Principles

- **Read-only.** Reports never mutate operational data. They read from base tables and
  purpose-built SQL **views**/queries.
- **Scope-aware.** Engineer report queries are filtered to assigned projects *before*
  aggregation; admins see firm-wide.
- **Consistent UX.** Every report shares a filter bar (date range + report-specific filters), a
  results table/chart, and the same export controls.
- **Export = the filtered result.** PDF/Excel/CSV reflect exactly what's on screen, not the
  whole table.

## 2. Report catalog

| Report | Purpose | Key filters | Primary sources |
|--------|---------|-------------|-----------------|
| **Project progress** | Status & % complete per project/phase/task | project, status, date | projects, phases, tasks |
| **Daily site report** | DSRs over a period | project, date range | daily_reports (+children) |
| **Budget vs actual** | Planned vs approved actual, variance | project, category | budgets, budget_lines, expenses |
| **Expense report** | Expenses with filters & totals | project, category, supplier, status, date | expenses |
| **Cash flow report** | In/out & running balance | project, direction, category, date | cashflow_tx |
| **Inventory movement** | All ledger movements | item, location, type, date | stock_ledger |
| **Issued vs used vs remaining** | Material reconciliation per project | project, item | stock_ledger, dsr_materials |
| **Project used materials** | What a project consumed | project, item, date | stock_ledger (USAGE), dsr_materials |
| **Low stock** | Items at/below reorder level | category, location | item_stock_balances, items |
| **Damaged/lost materials** | Damage/waste/loss events | item, project, type, date | stock_ledger (DAMAGE/WASTE/LOSS), inventory_movements |
| **Timeline delay** | Delayed phases/tasks & lateness | project, severity, date | tasks, phases |
| **Employee activity** | Who did what (reports, receipts, approvals) | employee/user, action, date | audit_logs, dsr_*, releases |

## 3. Query strategy

- Define a **SQL view per report** (or a well-named query function) encapsulating the joins and
  aggregations — keeps logic out of the UI and reusable by both screen and export.
- Heavy aggregations (issued/used/remaining, budget vs actual) read from the ledger/expense
  tables with proper indexes ([02](02-data-model.md) §10).
- For large date ranges, **paginate** the on-screen table and **stream** exports.
- Cache expensive report results briefly where the data tolerates slight staleness (configurable),
  but always provide a "refresh."
- The reconciliation math (issued/used/remaining) is defined once in
  [05-core-flows.md](05-core-flows.md) §7 and reused by report + dashboard.

## 4. Export

| Format | Library | Use |
|--------|---------|-----|
| **CSV** | `csv-stringify` | Raw data, re-import to Excel/Sheets |
| **Excel** | `ExcelJS` | Formatted sheets, multiple tabs, totals, styling |
| **PDF** | React-PDF | Printable management reports with header/branding |

Export rules:
- Export takes the **current filters**; same numbers as the screen.
- PDF carries firm name/logo, report title, filter summary, generated-at timestamp, and the
  user who generated it.
- Excel includes a header block (filters, totals) and typed columns (dates as dates, money as
  numbers).
- Large exports run server-side and, if slow, generate to object storage and return a download
  link (avoid timeouts).
- Respect scope: an engineer's export can only contain their projects' data.

## 5. Implementation notes

- Reports live in `modules/reports/` with one query + one export mapper per report.
- A shared `<ReportShell>` provides the filter bar, table, chart slot, and export buttons so all
  reports look and behave the same.
- Charts (Recharts/Tremor) for progress, budget usage, cash flow, movement trends; tables for
  detail.
- Add new reports by adding a query + mapper + registry entry — the shell handles the rest.

## 6. Acceptance criteria

- Every report in the catalog renders with working filters and exports correctly to all three
  formats.
- Engineer-scoped reports never reveal other projects' data (verified by test).
- Exported figures match on-screen figures for the same filters.
- The four reconciliation reports (movement, issued/used/remaining, used materials, damaged/lost)
  tie back to the ledger.

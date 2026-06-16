# 05 — Core Flows

End-to-end process flows. Each shows the actors, the steps, the state changes, and the rows
written. These are the "happy paths" plus their key branches; exact field rules live in the
module specs ([04](04-modules.md)) and ledger design ([06](06-inventory-ledger.md)).

---

## 1. Project flow

```mermaid
sequenceDiagram
    actor Admin
    actor Eng as Engineer
    Admin->>System: Create project (client, contract, dates, scope)
    Admin->>System: Assign lead engineer
    System-->>Eng: Project appears on engineer's dashboard
    Admin->>System: Create phases & tasks
    loop Each site day
        Eng->>System: Submit Daily Site Report
        System->>System: Update progress, post material USAGE
        System-->>Admin: notify dsr.submitted
    end
    Admin->>System: Monitor progress & reports
    System->>System: Daily job flags delayed tasks
    System-->>Admin: notify task.delayed
    Admin->>System: Mark project Completed (sets actual_end_date)
```

**Writes:** `projects`, `phases`, `tasks`, `daily_reports`(+children), `stock_ledger`(USAGE),
`audit_logs`, `notifications`.

**Branches:** task past due → `is_delayed` + `task.delayed`; high-severity DSR issue →
`dsr.issue.flagged`.

---

## 2. Inventory flow (the core loop)

```mermaid
sequenceDiagram
    actor Admin
    actor Eng as Engineer
    Admin->>System: Record Stock-In (item, supplier, qty, cost, location)
    System->>Ledger: +STOCK_IN row, balance += qty
    Eng->>System: Create Material Request (project, items, qty)
    System->>Approvals: PENDING approval
    System-->>Admin: notify material_request.submitted
    Admin->>System: Approve MR (set qty_approved)
    System-->>Eng: notify material_request.approved
    Admin->>System: Record Release (from location, qty)
    System->>Ledger: -RELEASE row, balance -= qty
    System->>System: mr_lines.qty_released += qty
    Eng->>System: Confirm Site Receiving (qty received, shortage?)
    System->>Ledger: +RECEIPT row at site (if tracked)
    alt shortage
        System->>System: open discrepancy; raise LOSS/DAMAGE (→ approval)
        System-->>Admin: notify receiving.discrepancy
    end
    Eng->>System: DSR records materials used
    System->>Ledger: -USAGE row
    System->>Reports: issued vs used vs remaining updated
```

**State on the MR:** `PENDING → APPROVED → PARTIALLY_RELEASED → RELEASED`.
**Writes:** `stock_ins`, `material_requests`, `releases`, `site_receipts`,
`inventory_movements`(on shortage), `stock_ledger`, `item_stock_balances`, `approvals`,
`notifications`, `audit_logs`.

> Stock changes **only** via ledger postings. Balances are updated in the same transaction as
> the ledger insert. See [06](06-inventory-ledger.md).

---

## 3. Budget & expense flow

```mermaid
sequenceDiagram
    actor Admin
    actor User
    Admin->>System: Set project budget (categorized lines)
    User->>System: Submit expense (amount, category, supplier, receipt)
    System->>Approvals: PENDING approval (type EXPENSE)
    System-->>Admin: notify expense.submitted
    alt approved
        Admin->>System: Approve expense
        System->>System: expense.status = APPROVED (counts as actual)
        System-->>User: notify expense.approved
        System->>System: recompute budget vs actual
        opt actual > budget threshold
            System-->>Admin: notify budget.exceeded
        end
    else rejected
        Admin->>System: Reject (with reason)
        System-->>User: notify expense.rejected
    end
```

**Writes:** `budgets`, `budget_lines`, `expenses`(+attachments), `approvals`, `notifications`,
`audit_logs`. Only `APPROVED` expenses feed budget-vs-actual and the dashboard.

---

## 4. Cash flow flow

```mermaid
sequenceDiagram
    actor Admin
    Admin->>System: Record inflow (client payment / billing collection)
    System->>System: cashflow_tx (direction=IN)
    Admin->>System: Record outflow (supplier / rental / subcontractor)
    System->>System: cashflow_tx (direction=OUT)
    Admin->>System: View cash position = Σ IN - Σ OUT
```

**Writes:** `cashflow_tx`, `audit_logs`. Cash position computed per project and firm-wide.

---

## 5. Approval state machine (shared)

```mermaid
stateDiagram-v2
    [*] --> PENDING: requester submits
    PENDING --> APPROVED: approver accepts
    PENDING --> REJECTED: approver rejects (note required)
    PENDING --> CANCELLED: requester withdraws
    APPROVED --> [*]
    REJECTED --> [*]
    CANCELLED --> [*]
```

**On `APPROVED`, in one DB transaction**, the approval's *effect* is applied based on `type`:

| Approval type | Effect on approval |
|---------------|--------------------|
| `MATERIAL_REQUEST` | MR becomes releasable; `qty_approved` set; no stock moved yet |
| `EXPENSE` | expense.status → APPROVED; counts as actual cost |
| `BUDGET_ADJUSTMENT` | new budget version becomes ACTIVE; prior SUPERSEDED |
| `INVENTORY_ADJUSTMENT` | post signed `ADJUSTMENT` ledger row; balance corrected |
| `DAMAGE` / `LOSS` | post negative ledger row; balance reduced |

Each transition writes an `audit_logs` row and emits `approval.decided`.

---

## 6. Notification flow (cross-cutting)

```mermaid
sequenceDiagram
    participant Svc as Service Layer
    participant Bus as Event Bus
    participant Disp as Notification Dispatcher
    participant SMTP
    Svc->>Bus: emit event (e.g. material_request.approved)
    Bus->>Disp: deliver event
    Disp->>Disp: check notification_settings (enabled? recipients?)
    Disp->>Disp: render template
    Disp->>SMTP: send email
    alt success
        SMTP-->>Disp: ok
        Disp->>System: notifications.status = SENT
    else failure
        SMTP-->>Disp: error
        Disp->>System: status = FAILED, schedule retry
    end
    Disp->>System: write audit (notification event)
```

The originating action commits **before/independently of** email delivery — a down SMTP server
never blocks an approval or report submission. See [08](08-notifications.md).

---

## 7. Issued vs Used vs Remaining (how the numbers tie out)

For a project + item:

```
Issued    = Σ release_lines.qty_released to that project's sites
Received  = Σ site receipts (confirmed at site)
Used      = Σ dsr_materials.quantity (USAGE ledger rows) for the project
Returned  = Σ RETURN movements from the project's site
Remaining = Received − Used − Returned
Shortage  = Issued − Received
```

This is computed from the ledger + DSR usage, not stored, so it is always reconcilable. Drives
the "Materials issued vs used vs remaining" and "Project used materials" reports
([09](09-reports-and-export.md)).

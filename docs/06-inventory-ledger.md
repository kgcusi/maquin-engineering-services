# 06 — Inventory Ledger & Traceability

This is the most important technical design in the system. Get it right and traceability,
reports, and dashboards fall out almost for free. Get it wrong (mutable stock counters that get
`+`/`-` in place) and the firm will never fully trust the numbers.

## 1. The core idea

> **Stock is not a number you edit. It is the running sum of an append-only log of movements.**

- Every change to inventory is one **immutable** row in `stock_ledger` with a **signed**
  quantity (`+` adds, `−` removes).
- The **current balance** of an item at a location is the sum of its ledger rows. We cache that
  sum in `item_stock_balances` for speed, but the cache is **always rebuildable** from the
  ledger.
- Because every row carries its **source** (which stock-in/release/DSR/movement) and **actor**
  (who), the full history — who requested, approved, released, received, used, returned,
  transferred, damaged, wasted, lost — is just a query.

This is the same pattern double-entry accounting uses for money. We apply it to materials.

## 2. Movement types

| `movement_type` | Sign | Posted by | Approval first? |
|-----------------|:----:|-----------|:----------------:|
| `STOCK_IN` | + | Stock-In ([5.15](04-modules.md)) | no |
| `RELEASE` | − | Release ([5.17](04-modules.md)) at source location | MR approved first |
| `RECEIPT` | + | Site Receiving at site location | no |
| `RETURN` | + (dest) / − (src) | Movement: return | no (config) |
| `TRANSFER_OUT` | − | Movement: transfer (source) | no |
| `TRANSFER_IN` | + | Movement: transfer (destination) | no |
| `DAMAGE` | − | Movement: damage | **yes** |
| `WASTE` | − | Movement: waste | **yes** |
| `LOSS` | − | Movement: loss/missing | **yes** |
| `ADJUSTMENT` | ± | Movement: manual adjustment | **yes** |
| `USAGE` | − | Daily Site Report materials | no (see §6) |

> Sign is derived server-side from `movement_type` + direction. The UI collects a positive
> quantity; the domain layer assigns the sign. Clients never send signed quantities.

## 3. The ledger table (recap)

`stock_ledger` ([02](02-data-model.md) §7.7) — append-only:

```
id, item_id, location_id, movement_type, quantity(signed),
unit_cost, source_type, source_id, project_id, actor_id, occurred_at, created_at
```

**Rules that must be enforced:**
- No `UPDATE`, no `DELETE` on this table — ever. (Enforce in code; optionally with a DB rule/
  trigger or restricted DB grants.)
- A correction is a **new reversing row**, not an edit.
- Every insert happens inside the same transaction as the operation that caused it and the
  matching `item_stock_balances` update.

## 4. Balances (the cache)

`item_stock_balances(item_id, location_id, quantity, updated_at)` — one row per item/location.

**Maintained transactionally:** when you insert a ledger row of signed quantity `q` for
`(item, location)`, you `UPDATE item_stock_balances SET quantity = quantity + q`. If the pair
doesn't exist, insert it. Do both in the transaction; never one without the other.

**Rebuild / reconcile job:** a maintenance routine recomputes balances from the ledger and
compares to the cache. Any mismatch is a bug or tampering signal and is reported. This is your
safety net and your proof the cache is trustworthy:

```
balance(item, location) == Σ stock_ledger.quantity WHERE item_id, location_id
```

**Total on-hand** for an item = Σ over its locations. **Available** may later subtract reserved
quantities (see §8).

## 5. Posting each operation (transaction recipes)

Each recipe is one atomic transaction. If any step fails, the whole thing rolls back.

### 5.1 Stock-In
For each line: insert `+STOCK_IN` ledger (qty, unit_cost, location) → bump balance →
write `stock_in_lines`. Then `stock_ins` header + audit. Optionally clear low-stock flag if the
new balance ≥ reorder level.

### 5.2 Release (against an approved MR)
Pre-check: source balance ≥ requested per line (else reject the release). For each line:
insert `−RELEASE` ledger at source → decrement balance → `release_lines` → increment
`mr_lines.qty_released`. Update MR status (`PARTIALLY_RELEASED`/`RELEASED`). Header + audit +
`release.created` event.

### 5.3 Site Receiving
For each released line: engineer enters received qty. Sites **are** locations (non-optional,
[17](17-audit-decisions.md) §3), so insert `+RECEIPT` at the site location → bump site balance.
Compute `shortage = released − received`. If shortage > 0: open a discrepancy tagged with a
**neutral reason** (In transit / Partial / Miscount / Damaged / Lost — [17](17-audit-decisions.md)
§6), not a stored `OK/SHORT/OVER/DAMAGED` status. **Only** *Damaged*/*Lost* posts an
approval-gated `inventory_movements` `DAMAGE`/`LOSS`; *In transit*/*Partial* stays an open
discrepancy that auto-reconciles on a later receipt (**no auto-created LOSS/DAMAGE**). Emit
`receiving.confirmed` / `receiving.discrepancy`.

### 5.4 Return
`+RETURN` at destination (e.g. warehouse), `−RETURN` at source (site) — two rows, balances
updated for both. Header + audit + `movement.posted`.

### 5.5 Transfer
`−TRANSFER_OUT` at source and `+TRANSFER_IN` at destination — a matched pair in one
transaction. Balances both updated.

### 5.6 Damage / Waste / Loss
Created as `inventory_movements` status `PENDING` with reason + proof; **no ledger row yet**.
On approval: insert the negative ledger row (`DAMAGE`/`WASTE`/`LOSS`) at the source location →
decrement balance → movement status `POSTED`. Emit `movement.posted`; feeds the damaged/lost
report.

### 5.7 Adjustment
For a physical count `counted` vs system `system`: `delta = counted − system`. Created
`PENDING` with mandatory reason. On approval: insert signed `ADJUSTMENT` ledger row of `delta`
→ set balance to `counted`. This is the **only** sanctioned way to make the system match a
recount, and it is fully audited.

## 6. Usage from Daily Site Reports

`dsr_materials` rows linked to an `item_id` represent consumption. **Policy is fixed (Option A, no
per-project toggle — [17](17-audit-decisions.md) §3/§10.4):**

- On DSR submit, each linked material posts a `−USAGE` ledger row at the project's site location,
  carrying `source_type='dsr_material'` + `source_id = dsr_materials.id` (line-level provenance).
- **Stage 2 only reserves the link** (`dsr_materials` gets a stable uuid PK); the actual `−USAGE`
  posting is wired in **Stage 3** once the ledger exists.
- Editing/re-opening a submitted DSR is modeled as **new `dsr_materials` rows**, so reversal posts
  compensating entries against the exact original `source_id`s — the target never moves.

**Used** in the issued/used/remaining math comes from these USAGE rows, so the report always
reconciles with the ledger. Negative on-hand (using more than received) is allowed but flagged by
default, since field reality may precede paperwork.

## 7. Traceability queries (what the ledger gives you for free)

| Question | Query shape |
|----------|-------------|
| Full history of an item | `stock_ledger WHERE item_id ORDER BY occurred_at` + running sum |
| History at a location | add `AND location_id` |
| Who released/received/used X | join `source_type/source_id` → source row → actor; or `actor_id` directly |
| Everything for a project | `WHERE project_id` across all movement types |
| Issued vs used vs remaining | aggregate RELEASE/RECEIPT/USAGE/RETURN per item/project ([05](05-core-flows.md) §7) |
| Damaged/lost report | `WHERE movement_type IN (DAMAGE, WASTE, LOSS)` |
| Low stock | `item_stock_balances` totals vs `items.reorder_level` |
| Stock value | Σ `quantity × unit_cost` (choose FIFO/weighted-avg — see §9) |

Every traceability screen ([5.19](04-modules.md)) is a read over this one table joined to its
sources and actors. Deep-link each row to its originating document.

## 8. Reservations (optional, recommend for v2)

To prevent over-promising stock, an **approved-but-not-released** MR can *reserve* quantity:
`available = on_hand − reserved`. Implement as a derived sum over open MR lines, or a small
`reservations` table. Out of scope for v1 unless the firm hits the problem; the ledger design
already supports adding it without migration pain.

## 9. Valuation (cost) note

`unit_cost` is snapshotted on each `STOCK_IN` (and carried where relevant). For stock value and
"cost of materials used," choose a method up front and document it:

- **Weighted average (recommended, simplest):** running avg cost per item; usage valued at the
  current average.
- **FIFO:** value consumption against the oldest layers; more complex, needs layer tracking.

v1 can report **quantity** traceability fully and **value** at weighted average. True FIFO is a
v2 enhancement. Don't block v1 on perfect costing.

## 10. Why this design

- **Trust:** nothing is silently edited; corrections are visible and attributable.
- **Reports for free:** issued/used/remaining, movement, low-stock, damaged/lost all read one
  log.
- **Reconcilable:** balances can always be proven against the ledger.
- **Extensible:** reservations, multi-warehouse, valuation methods, and barcode scanning all
  bolt on without reshaping the core.

The single rule to protect at all costs: **never let anything change stock except by inserting
a ledger row inside a transaction that also updates the balance.**

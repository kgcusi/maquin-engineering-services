# 17 — Audit Decisions (Addendum)

> **Status.** This doc records the decisions made after the planning audit (three independent
> reviewers: simplicity, UX/flows, architecture). Where it conflicts with details in 00–16, **this
> doc wins**; the affected sections get reconciled into their home docs **during implementation**,
> at which point the open questions in §8 are confirmed with the stakeholder. The genuine spec
> bugs (§4) and the schema-level decisions are already patched into the source docs.

---

## 1. Scope decision — KEEP all Bucket 2 features

The stakeholder confirmed the "deferrable" features are **discussed and required**. They stay in
v1:

- Formal **budget versioning** (versions + supersede + approval)
- **In-app notification center** (bell/inbox) alongside email
- **Digest** emails
- **Multi-warehouse transfers**
- **Damage / Waste / Loss** as distinct movement types
- The **full 12-report** catalog
- **Excel (.xlsx)** export (plus CSV + PDF)
- Expense **payment tracking** (`payment_status` + record-payment → cash-out link)

> Do not re-propose cutting these. Implementation specifics (cadences, formatting, exact UX) are
> confirmed per-feature at build time (§8).

### Applied anyway — invisible structural cleanups (no feature lost, reversible)

These reduce complexity with **zero** user-facing change:

- **Merge the 6 attachment/document/note link tables → one polymorphic `attachments` table**
  (`entity_type, entity_id, file_id, label, kind, created_by, created_at`). Files still attach to
  clients, projects, tasks, expenses, DSRs identically. `client_notes` → a generic `notes` table
  with the same polymorphic shape.
- **Roles/permissions as a static code map**, not DB tables (two roles only — see §2). Permission
  **keys** stay the contract; graduating to tables later is additive.
- **One engineer per project** via `lead_engineer_id`; drop `project_members` (additive later).

### Explicitly KEPT (was a candidate cut, but it's a required feature)

- **Site receiving** (received qty, shortage notes, proof attachments) — required by the original
  proposal §5.17. Therefore **sites ARE inventory locations** (resolves the old "(if sites are
  tracked)" hedge to **yes**) and per-site balances are maintained. The concurrency/immutability
  fixes in §5 make that safe.

---

## 2. Inventory roles & workflow — Combined + Quick-Issue

Two roles retained (Admin, Engineer). To remove the single-admin bottleneck without adding a role:

- **Approve-and-Release in one action.** When an admin approves a Material Request, the same screen
  offers "Approve & Release" so it's one trip, not two forms. (The MR still records approval +
  release distinctly in the ledger/audit.)
- **Quick Issue (Direct Release).** For over-the-counter handouts, an admin issues stock straight
  to a project in one form. Behind the scenes it auto-creates a closed, auto-approved MR so the
  ledger and traceability stay whole. The **full** request→approve→release→receive chain remains
  for engineer-initiated/remote requests.
- Permission **keys** are written so a future **Storekeeper** role (holding `stockin.create` +
  `release.create`) can be switched on later with no code change.

---

## 3. Resolved forks (the "choose one… document it" items, now chosen)

| Fork | Decision |
|------|----------|
| **Money type** | `DECIMAL(14,2)` in the DB; a `Money` value object in TS. Drizzle custom `money` type defined once. Valuation = `qty(14,3) × cost(14,2)` then **round half-up to 2 dp on the product**. |
| **Progress %** | **Derived**: phase = weighted avg of its tasks (by task count for v1); project = roll-up of phases. Plus `progress_is_manual boolean default false` to pin a manual value. |
| **DSR material usage** | **Option A** — post `−USAGE` ledger rows on DSR submit. Add line-level linkage (`dsr_materials.id` carried on the ledger source, or a `ledger_entry_id` back-ref) so editing a submitted DSR reverses the exact rows. No per-project toggle. |
| **Sites as locations** | **Yes, non-optional.** Creating a project auto-creates its `SITE` location. RELEASE/RECEIPT/USAGE/RETURN carry `project_id`. Drop all "(if tracked)" hedges. |
| **API style** | **Server Actions for all mutations** (one `action()` guard → service → transaction). Route handlers only for: file signed-URLs, cron endpoints, the Resend webhook, and report-export downloads. `11-api-design` is re-read as "service operations + the few real HTTP routes." |
| **Phase statuses** | Own `phase_statuses` lookup (not shared with `task_statuses`). |
| **Better Auth ↔ users** | Better Auth owns `user`/`session`/`account`/`verification` (canonical for auth). Extend `user` with `role`, `is_active`, `employee_id`. **Remove `password_hash` from the domain user table** (it lives in `account`). Domain FKs reference the Better Auth user id. `is_active=false` enforced via a session check + the admin `ban` plugin (Better Auth doesn't auto-revoke on a flag flip). Settle table naming (configure plural, or document `user`/`account` as an exception to the plural rule). |

---

## 4. Spec bugs fixed (patched in source docs)

1. **`approvals.type` was missing `WASTE`** — but waste movements require approval, so the flow
   couldn't create its approval row. Added `WASTE`. (02 §6.1)
2. **`notifications.status` had no `DELIVERED`/`BOUNCED`/`COMPLAINED`** — the Resend-webhook plan
   was unstorable. Added them. (02 §8.2)
3. **`postgres-js` + Neon pooled needs `prepare: false`** — pooled = PgBouncer transaction mode,
   which breaks prepared statements. Corrected in 01 §5.2 and 16 §2.
4. **Polymorphic `entity_id`/`source_id` typed as `string`** — changed to `uuid` (FK targets are
   all uuid) to restore index efficiency and avoid uuid-vs-refcode format drift. (02 §2.3/§6.1/§7.7)

---

## 5. Technical corrections to apply (build checklist)

- [ ] **Balances cache** updated atomically: `INSERT … ON CONFLICT (item_id, location_id) DO UPDATE
      SET quantity = item_stock_balances.quantity + EXCLUDED.quantity`, with row locking; **drift
      policy = alert + admin-triggered rebuild, never silent auto-fix**. (06 §4)
- [ ] **Immutability is DB-enforced, not optional**: `BEFORE UPDATE OR DELETE` triggers that raise
      on `stock_ledger` and `audit_logs` (works with a single app role). (06 §3, 12 §4)
- [ ] **CHECK constraints enumerated**: `amount > 0` on `cashflow_tx`, `expenses`,
      `budget_lines`; `quantity > 0` on request/movement/stock-in lines; `progress_pct 0–100`. (02 §10)
- [ ] **Enum reconciliation**: one table mapping `inventory_movements.type` ↔
      `stock_ledger.movement_type` ↔ `approvals.type`; standardize `ADJUSTMENT` vs
      `INVENTORY_ADJUSTMENT` to one spelling. (02)
- [ ] **Resend webhook**: `POST /api/webhooks/resend`, **Svix signature verification** (not
      `CRON_SECRET`), store `resend_message_id` on send, map webhook → row by it, status precedence
      (a late `delivered` can't overwrite `complained`). (08, 16 §4)
- [ ] **R2 uploads**: presign with `Content-Length`/`Content-Type` conditions so R2 *rejects* bad
      PUTs; a **confirm step** (`POST /files/:id/confirm` → HEAD the object) before a `files` row is
      usable; **scheduled orphan-cleanup** (not optional). Fix 11 §7 ("streams to storage" is wrong
      for direct PUT). (16 §5, 11 §7, 13 §4)
- [ ] **Cache invalidation is synchronous in the Server Action** (after commit), **not** via the
      async notification outbox. Define the **tag taxonomy** up front: `settings`,
      `project:{id}:budget`, `project:{id}:materials`, `project:{id}:progress`, `dashboard:{userId}`,
      etc. (16 §7)
- [ ] **One RBAC wrapper** `action(permissionKey, zodSchema, fn)`: session → `is_active` →
      permission → project scope → validate → transaction. Hygiene rule: **no raw Server Action
      without it** (an unguarded action is a public POST). Next's Server Action origin check covers
      CSRF for that path. (11, 03)
- [ ] **Idempotency** key (client uuid) on creates with no natural unique key (expenses, cashflow,
      stock-ins, releases); unique per (action, key), short TTL — a retry returns the original. Ref
      codes do **not** prevent duplicates. (11 §5)
- [ ] **DSR resilience**: local **draft autosave** (persist field state so a reload doesn't lose the
      report) + **client-side photo compression** + resumable photo uploads. (04 §5.10, 13)

---

## 6. UX improvements adopted

- [ ] **DSR carry-forward**: "New DSR" prefills manpower + equipment from the project's last
      submitted DSR (editable); optional saved "standard crew" template. *(biggest daily win)*
- [ ] **Shortage = neutral reason picker** (In transit / Partial / Miscount / Damaged / Lost). Only
      *Damaged*/*Lost* posts an approval-gated movement; *In transit*/*Partial* stays an open
      discrepancy that auto-reconciles on later receipt. **Stop auto-creating LOSS/DAMAGE.**
- [ ] **Revise & Resubmit** for rejected MRs/expenses: clone into an editable draft pre-filled with
      the original lines + the rejection note, then a fresh PENDING approval. (No dead-end at
      `REJECTED`.)
- [ ] **Partial-release close-out**: show outstanding qty per line to both roles; allow follow-up
      releases against the same MR; explicit "close MR / cancel remainder (reason)".
- [ ] **MR draft state** (like the DSR) + optional per-line note; **Approvals inbox sorted by
      needed-date / impact**, not pure FIFO.
- [ ] **Finance explainer strip** on the project hub: *Contract (client price) · Budget (planned) ·
      Spent (approved) · Cash on hand* with one-line tooltips — instead of four unlabeled cards.
- [ ] **Issued/Used/Remaining as a labeled waterfall** (Issued → Received → shortage → Used →
      Returned → Remaining), spelling out that *Remaining is of what arrived on site*.
- [ ] **DSR self-correction**: author may edit/re-open their own DSR within a same-day window
      before an admin acts; re-open posts **reversing USAGE** rows (surface this to the user).
- [ ] **Admin first-run setup checklist** on the empty dashboard (Location → Items → Client →
      Project → Assign engineer), ticking off as data appears; a couple of deletable demo records.
- [ ] **Self-approval honesty**: when one admin approves their own request, label it "self-approved
      — single-admin mode" in the UI + audit log.

---

## 7. What stays as originally designed (audit confirmed these are right)

- The **append-only `stock_ledger`** + balances-cache pattern (the core bet).
- The **polymorphic `approvals`** table + state machine (now with `WASTE` added and Revise &
  Resubmit).
- Budget / Contract / Expense / Cash Flow kept as **four distinct truths** (fixed via UI labeling,
  not by merging the data).
- Event-driven notifications via outbox + Vercel Cron drain.

---

## 8. To confirm at implementation time (per stakeholder request)

Surface these when building the relevant feature:

- **Quick Issue** exact UX and which item categories qualify for over-the-counter handout.
- **Digest** cadence and which events digest vs send immediately.
- **In-app notification center** behavior (mute, per-user preferences).
- **12 reports** build priority order; **Excel** formatting needs (tabs, totals, branding).
- **Budget versioning** approval threshold (does every edit need sign-off, or only material ones?).
- **Damage/Waste/Loss** — confirm the firm's working definitions so the reason picker matches.
- **Self-approval policy** — is single-admin self-approval acceptable, or must a second person sign
  finance items above a threshold?
- **Currency / timezone** (defaulted `PHP` / `Asia/Manila`).
- **DSR same-day edit window** length.
- **Better Auth** table naming convention (plural override vs documented exception).

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
- **Roles/permissions as a static code map**, not DB tables (a small fixed role set — see §2 and
  §10 addendum). Permission **keys** stay the contract; graduating to tables later is additive.
- ~~**One engineer per project** via `lead_engineer_id`; drop `project_members`~~ — **superseded by
  §10.1**: `project_members` ships in Stage 2 (multi-person sites; the scope predicate / IDOR guard /
  `PROJECT:*` resolution are written once, not migrated later).

### Explicitly KEPT (was a candidate cut, but it's a required feature)

- **Site receiving** (received qty, shortage notes, proof attachments) — required by the original
  proposal §5.17. Therefore **sites ARE inventory locations** (resolves the old "(if sites are
  tracked)" hedge to **yes**) and per-site balances are maintained. The concurrency/immutability
  fixes in §5 make that safe.

---

## 2. Inventory roles & workflow — Combined + Quick-Issue

Two roles handle inventory (Admin, Engineer — QA/QC plays no inventory part). To remove the
single-admin bottleneck without adding an inventory role:

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
| **Progress %** | **Derived**: phase = weighted avg of its tasks (by task count for v1); project = roll-up of phases. Plus `progress_is_manual boolean default false` to pin a manual value. **Computed on write — §10.3.** |
| **DSR material usage** | **Option A** — post `−USAGE` ledger rows on DSR submit. Add line-level linkage (`dsr_materials.id` carried on the ledger source, or a `ledger_entry_id` back-ref) so editing a submitted DSR reverses the exact rows. No per-project toggle. **Link = ledger `source_id`; edits = new rows — §10.4.** |
| **Sites as locations** | **Yes, non-optional.** Creating a project auto-creates its `SITE` location. RELEASE/RECEIPT/USAGE/RETURN carry `project_id`. Drop all "(if tracked)" hedges. |
| **API style** | **Server Actions for all mutations** (one `action()` guard → service → transaction). Route handlers only for: file signed-URLs, cron endpoints, the Resend webhook, and report-export downloads. `11-api-design` is re-read as "service operations + the few real HTTP routes." |
| **Phase statuses** | ~~Own `phase_statuses` lookup~~ — **superseded by §9**: phase status is *derived* from rolled-up progress, not stored. |
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

---

## 9. Fixed lookups — statuses / categories / units / trades are code-owned (supersedes the lookup tables)

The stakeholder confirmed these values don't need per-firm customization, so the
**admin-editable System Settings lookup tables are dropped** in favor of **fixed, code-owned
values**. This **supersedes** `02 §2.4` (the lookup-tables block), `00 §7` (the enums-vs-lookup
paragraph), `04 §5.3` (the per-list CRUD managers), and the `*_id` FK rows that pointed at these
tables. Done now (low-risk: the domain schema isn't built yet, so **nothing is dropped from the
DB** — the not-yet-written schema is authored directly in the fixed shape).

**Why it's not uniform.** "Status" had conflated three different things; each gets the right
mechanism:

| Bucket | What | Mechanism | Lives in |
|--------|------|-----------|----------|
| **State machine** | code branches on it; stored | Postgres **`pgEnum`** (DB-enforced) | schema + `src/lib/statuses.ts` (value tuple, single-sourced) |
| **Descriptive label** | code never branches on it; just attached + displayed | **TS const map + plain `text` code column** (no table, no FK, no join) | `src/lib/lookups.ts` |
| **Derived** | a roll-up; shouldn't be stored | computed in queries/services | `src/lib/statuses.ts` |

Adding a unit/trade/category is now a **one-line edit** to the const — **no migration** (the
column is plain `text` validated by Zod against the const, inside the `action()` wrapper).

### Group A — the former lookup statuses

- **Project** (`pgEnum projects.status`, manual lifecycle): `PLANNING → ACTIVE ⇄ ON_HOLD →
  COMPLETED`; any → `CANCELLED`. **Not derived** — completion is a human sign-off (sets
  `actual_end_date`). **Warranty/retention are facts, not states:** add `projects.
  defects_liability_until date N`; an **"In Warranty"** badge is *derived* (`status = COMPLETED
  AND today ≤ defects_liability_until`, mirroring `is_delayed`). Defects → `notes`; retention
  release → a **cashflow category** (`RETENTION_RELEASE`), never a project field.
- **Task** (status **derived, not stored**): the engineer reports `progress_pct` (the single
  input at the leaf); status = `0 → Not Started`, `1–99 → In Progress`, `100 → Done` (sets
  `completed_date`). Orthogonal overlays: `is_blocked boolean` + `blocked_reason text N`, and
  `is_delayed` (derived from `due_date`). **UI:** the progress editor must show the
  remaining/total context so entry is informed.
- **Phase** (status **derived, not stored**): `progress_pct` = weighted avg of its tasks (§3);
  same 3-state mapping as tasks; `is_delayed` from `target_end_date`. The §3 "own
  `phase_statuses` lookup" line is **moot** (it solved an admin-editing problem we no longer
  have).

### Group B — workflow enums (all `pgEnum`; pin these spellings before the first migration)

`approvals.status` is the **single source of truth for the decision**
(`PENDING/APPROVED/REJECTED/CANCELLED`). `expenses.status` and `material_requests.status` are a
**denormalized projection** of the outcome, written **only** in the approval-resolution
transaction (`05 §5`); the MR projection extends past the gate for `PARTIALLY_RELEASED/
RELEASED`. Single writer ⇒ no drift; keeps "only APPROVED counts" a column filter (no join).

Pinned value sets: `budgets` `(DRAFT,ACTIVE,SUPERSEDED)` · `daily_reports` `(DRAFT,SUBMITTED)` ·
`expenses.payment_status` `(UNPAID,PARTIAL,PAID)` · `expenses.status` `(PENDING,APPROVED,
REJECTED)` · `material_requests` `(DRAFT,PENDING,APPROVED,PARTIALLY_RELEASED,RELEASED,REJECTED,
CANCELLED)` · `releases` `(RELEASED,RECEIVED,DISCREPANCY)` · `inventory_movements`
`(PENDING,POSTED,REJECTED)` · `notifications` `(QUEUED,SENT,DELIVERED,BOUNCED,COMPLAINED,FAILED,
READ)`. The already-enum non-status sets are unchanged (`approvals.type` incl. `WASTE`,
`cashflow_tx.direction/method`, `locations.type`, `stock_ledger.movement_type`,
`dsr_issues.severity`, …). Apply the §5 `ADJUSTMENT` vs `INVENTORY_ADJUSTMENT` reconciliation and
implement `site_receipts` via the §6 neutral shortage **reason picker** rather than a stored
`OK/SHORT/OVER/DAMAGED` enum.

- **`employees.status (ACTIVE/INACTIVE)` collapses to `is_active boolean`** (it was a boolean in
  enum costume; matches `users.is_active`).

### Descriptive label sets (TS const + `text` code column) — see `src/lib/lookups.ts`

- **Units** (`items.unit_code`, `*_line.unit_code`, `dsr_materials.unit_code`): a focused
  construction set (~27), not the full UN/CEFACT catalogue.
- **Trades** (`employees.trade_code`, `dsr_manpower.trade_code`): PH-construction default set.
- **Cost categories** — **`budget_categories` + `expense_categories` unify into ONE set**
  (`budget_lines.category_code`, `expenses.category_code`) so budget-vs-actual reconciles on a
  single vocabulary.
- **Cash-flow categories** (`cashflow_tx.category_code`) and **inventory categories**
  (`items.category_code`) stay distinct (different axes).

### Dropped / kept

- **Dropped:** the `04 §5.3` per-list CRUD managers and the deactivate-not-delete / immutable-
  `code` machinery. **Kept:** `app_settings` (timezone, currency, company info) and
  `notification_settings` — those remain admin-editable.

---

## 10. Stage 2 design — Project Tracking (grilled & locked)

> Pre-build design review of Stage 2 (Projects 5.8 / Phases & Tasks 5.9 / DSR 5.10 + project
> notifications), stress-tested across four lenses — user-friendly, DB-efficient, service-efficient,
> secure. Same rule as the rest of this doc: **these win** over 00–16 and over the earlier sections
> flagged below; reconcile into home docs at build time.

1. **Engineer↔project assignment — `project_members` join now.** `project_members(project_id,
   user_id, role_on_project)` from day one, and the Stage 2 UI assigns a **lead + multiple member
   engineers** (the full team — see addendum #13). Index
   `(user_id, project_id)`; unique `(project_id, user_id)`. **Supersedes §1**'s "one engineer per
   project; drop `project_members`" — multi-person sites are real, and the scope predicate / IDOR
   defense / `PROJECT:*` resolution then get written **once** instead of migrated later. (04 §5.8)

2. **IDOR enforcement — centralized guard + scoped reads.** One mandatory `assertProjectAccess(ctx,
   projectId)` on the **resolved** project id (after task→phase→project / dsr→project lookup); read
   queries **bake the membership predicate in** so a page physically can't fetch unscoped; admins
   bypass via `project.view.all`; a test asserts every project-scoped module calls it. This makes the
   `action()` "project scope" hook (§5) real and — critically — covers **reads** too, since today's
   page guards are role-level only. Postgres RLS held in reserve for the Stage 3 ledger. (03, 11)

3. **Progress roll-up — computed on write, denormalized.** On a task `progress_pct` change, recompute
   `phases.progress_pct` (avg of its tasks) then `projects.progress_pct` (roll-up of phases) **in the
   same txn**; **skip when `progress_is_manual`**; `SELECT … FOR UPDATE` the phase then project row to
   avoid a lost-update race (two engineers can now edit one project); the daily job self-heals drift.
   Status stays **derived at read, unstored**. Refines §3 / §9-Group A — fixes *where* the derived
   number lives; invalidate via the existing `project:{id}:progress` tag. (02 §4, 16 §7)

4. **DSR→ledger link — provenance on the ledger.** `stock_ledger.source_type='dsr_material'` +
   `source_id = dsr_materials.id`; `dsr_materials` gets a **stable uuid PK**; edits to a submitted DSR
   are **new rows** (new ids → new postings) so the reversal target never moves. **Resolves §3's
   either/or** in favour of the ledger source over a `ledger_entry_id` back-ref — a back-ref can't
   express one line→many ledger rows (lots/FIFO) and fights the append-only reversal. Columns reserved
   in Stage 2; posting wired in Stage 3. (06 §6)

5. **DSR ownership — one per (project, date), collision-safe.** `UNIQUE(project_id, report_date)`,
   single `submitted_by`. "New DSR" detects today's row **up front** → edit / resume / read-only;
   **never fill-then-fail** at submit. Others view; admin re-opens (logged). Closes the gap decision 1
   opened (two engineers, one date); keeps the §9 `daily_reports (DRAFT,SUBMITTED)` enum. (04 §5.10)

6. **DSR resilience — server draft + local buffer, photos upload-on-pick.** Server DRAFT is the source
   of truth (debounced autosave) with a **localStorage write-through** buffer that replays newer edits
   on reconnect. **Each photo uploads the moment it's picked** (client-compress → the Stage-1 R2
   presign pipeline `createPendingUpload`/`confirmAttachment` → attach to the DRAFT), so the form holds
   **references only** and submit stays tiny. Refines §5 (DSR resilience) + §6 (carry-forward /
   self-correction) with the persistence + photo-flow specifics. (04 §5.10, 13 §4)

7. **`task.delayed` — stored `is_delayed` as transition state.** Nightly job flips `false→true` for
   newly-past-due tasks (one txn each), stamps `delayed_notified_at`, and **emits on the transition**;
   resets `true→false` on completion / due-date extension so a later slip re-notifies. The **read path
   derives delayed for display only — never writes.** Outbox `idempotencyKey` is the second dedupe
   layer. Makes "once per *newly* delayed task" idempotent and re-run-safe. Refines §9-Group A. (08,
   02 §4)

8. **Notification recipients — members minus actor.** `PROJECT:*` resolves to active `project_members`
   of the payload's project, **excluding the actor** (no "you did X" self-notes); dedup vs
   `ROLE:ADMIN` via the existing `idempotencyKey`. Emitters add **`projectId` + `actorId`** to the
   outbox payload; `role_on_project` enables lead-vs-member targeting (`dsr.submitted` → lead;
   `task.delayed` → all members). Unblocks `resolveRecipients`' `PROJECT:*` branch (returned `[]`
   pre-Stage-2). (08)

### Stage 2 workflow addendum — client process (grilled & locked, 2026-06)

> A second grilling round against the client's stated workflow ("Admin/GM/OM create projects &
> tasks → Engineers update/create tasks → request orders to purchasing / request inspection from
> QA/QC → submit billing docs → Finance check"). These **win** over 00–16 and refine §10 above.
> Finance/billing steps are Stage 4 and out of scope here.

9. **QA/QC is a distinct role, not a flavor.** Add `QA_QC_ENGINEER` (visible, non-admin).
   `role_on_project` scopes/targets only — it cannot narrow capabilities — so a tagged ENGINEER
   can't carry an inspection-only permission set; a separate role is the only honest model. (03 §1–3)
10. **Role + scoping ship in Stage 2; the inspection module is deferred.** The role, the reserved
    `inspection.*` keys, and the `INSPECTOR` membership grant land now; the
    request→inspect→pass/fail→rework module ships post-Stage-2 (04 §5.10a, 02 §4.5) — same
    "reserve now, wire later" pattern as the DSR→ledger link (§10.4).
11. **GM/OM → ADMIN; "purchasing" → Material Request flow.** No new roles for either: GM/OM create
    projects/tasks with ADMIN access, and "request orders to purchasing" is the Stage-3 MR flow
    (engineer raises → admin approves, 04 §5.16). (03 §1)
12. **Inspection request grants scoped access — invariant preserved.** Requesting an inspection
    inserts `project_members(role_on_project='INSPECTOR')` for the named QA/QC engineer, so the
    existing membership-baked reads let them open the project; no request → no membership → 404.
    Membership grants *scope*, never *capability*. (03 §4, 02 §4.5)
13. **Flat multi-engineer teams.** A project carries one `LEAD` + many `MEMBER` engineers, all with
    equal scoped capability; the lead is a display/notification label. `project_members` is already
    many-to-many — only §10.1's "single lead" wording opened up; no schema change. (02 §4.1)
14. **Engineers create/manage tasks (scoped).** `ENGINEER` gains `task.manage` scoped via
    `assertProjectAccess` to assigned projects, matching the client's "Engrs create task";
    `task.update.progress` stays the narrower assignee path; QA/QC gets `task.view` only. (03 §3–4)
15. **Inspection request names + notifies the QA/QC engineer on create.** The `assigned_to` chosen
    at request time drives both the `INSPECTOR` grant (#12) and an `inspection.requested`
    notification to that engineer; recording fires `inspection.recorded` to the requester. Needs a
    new `ROLE:QA_QC_ENGINEER` / direct-user recipient resolver (today's are `ROLE:*` / `PROJECT:*`
    only) — deferred wiring with the module. (08)

> **Implementer note.** Do **not** add `QA_QC_ENGINEER` to Better Auth `adminRoles` (same rule as
> WEBMASTER — a novel role there fails validation and breaks the build); it's a non-admin role and
> `defaultRole` stays `ENGINEER`. Authorization is ours via `ROLE_PERMISSIONS`.

### Carry-overs settled in code (no separate question)

- **Project status state machine** in a **pure domain function** called inside `project.update`
  (server-side, not just UI): `PLANNING→ACTIVE⇄ON_HOLD→COMPLETED`, `any→CANCELLED`, `COMPLETED`
  requires `actual_end_date` (mirrors §9-Group A).
- **Indexes:** `project_members(user_id, project_id)` + unique `(project_id, user_id)`;
  `projects(status)`, `projects(client_id)`; `phases(project_id, sequence)`; partial
  `tasks(due_date) WHERE progress_pct < 100` for the delay scan (status is derived, so filter on the
  number); `daily_reports` unique `(project_id, report_date)`; `dsr_*` children by `daily_report_id`.
- **Emitters** carry `projectId` + `actorId` in every project-domain outbox payload.
- Every state change audited; multi-row writes (DSR submit + children; task update + roll-up) in
  **one transaction** (consistent with Stage 1).

### Stage 2 review addendum — Templates & Inspection checklists (grilled & locked, 2026-06-23)

> A planning round on two presets capabilities, decided with the stakeholder. These **win** over
> 00–16 and refine §10 above; reconcile into home docs (02 §4.5–4.6, 04 §5.8a/§5.10a, 03) at build.

16. **Re-inspection = reopen in place + append-only history (NOT a new request).** A FAILED
    `inspections` row is re-inspected on the **same** record; **every recording appends an
    `inspection_attempts` row** (with its snapshotted `inspection_item_results`), and the
    inspection's `status`/`outcome_remarks` reflect the **latest** attempt. The outcome dialog
    pre-fills from the last attempt (passed items carry forward, editable). Chosen over a
    new-linked-request chain because forcing a full re-request (re-pick QA/QC, re-schedule,
    re-notify, re-fill) for a single failed item is too heavyweight — the stakeholder wanted a
    **history log**, not separate records. `attempt_no` is server-assigned (`max+1` in-tx); the
    `INSPECTOR` membership grant is already `onConflictDoNothing`, so re-recording never duplicates
    it. **Item results snapshot the checklist label** so later preset edits never rewrite history.
    Overall outcome stays a **deliberate human decision** (items are evidence, never an auto-gate).
    The QA/QC engineer **picks the preset checklist at inspection time** (by `category`); no
    checklist = today's free-form pass/fail. Photos attach **per item**
    (`attachments.entity_type='inspection_item_result'`). New `INSPECTION_ITEM_RESULTS`
    (`PASS`/`FAIL`/`NA`) pinned in `src/lib/statuses.ts`; `inspection_status` enum unchanged
    (`REQUESTED`/`PASSED`/`FAILED`). New keys `checklist.view`/`checklist.manage` (admin). (02 §4.5,
    04 §5.10a)

17. **Project Templates = duration-chained snapshot with an editable review step.** A template
    carries phases (each a `duration_days`, default 7) and tasks (a `weight_pct`); creating a
    project **from a template** computes a **sequential calendar-day** schedule from one project
    start date (phase 1 on the start; each next phase the day after the prior's
    `end = start + duration − 1`, inclusive) and surfaces a **review step where per-phase durations
    are adjustable (validated ≥ 1) AND each phase's task list is fully editable — rename, reweight,
    remove, or add — before any rows are written** (a phase's task weights may not exceed 100%,
    guarded client-side and in the service). **Phases stay the template's** (no add/remove/rename at
    the review step — edit them after the project exists). The client sends the **full edited task
    list per phase** keyed by template phase id, so the template's stored tasks are **not re-read**
    at instantiation (removing or reweighting a seeded task just works). **Snapshot, not link** — the
    cloned phases/tasks are independent of the template. Tasks carry **no dates** (phase-level
    scheduling only). Instantiation writes phases (target dates from the chain; actuals null;
    progress 0) + tasks (name + weight + sequence) in **one transaction** via a shared
    `instantiateTemplate(tx, …)` service, reused by both the create-time path and an
    apply-to-empty-project path. New keys `template.view`/`template.manage` (admin). **Out of v1:**
    working-day/holiday calendars, "save project as template", task-level durations, adding/removing
    phases at the review step. (02 §4.6, 04 §5.8a)

### Stage-1 pre-reqs (do before Stage 2 leans on them) — from the Stage-1 code audit

- [ ] **Reconcile `cookieCache.maxAge` (300s) vs the "60s" contract** — `auth.ts:41` is `300`, but
      `session.ts`, `rbac.ts`, `users/actions.ts`, and the deactivation-revoke wording all say 60s.
      Engineer scoping raises the stakes (a removed engineer keeps **read** access for the window).
      Pick `60` or rewrite the contract to `300`, deliberately.
- [ ] **Add `error.tsx` + `not-found.tsx`** at the `(app)` route-group level — none exist; the project
      hub, DSR pages, and IDOR-blocked / missing project ids are where undesigned crashes/404s land.
- [ ] **Cache the audit `DISTINCT` filter lists** (`listActionOptions` / `listEntityTypeOptions`,
      `audit/queries.ts`) — uncached scans over an append-only table that Stage 2 multiplies. `use
      cache` + short `cacheLife`.
- [ ] **Dispatcher N+1 + actor-exclusion** (`notifications/service.ts`) — load `notification_settings`
      once per batch, memoize role→recipients, and thread `actorId` (decision 8).

### Acceptance probes (beyond the §14 happy path)

Assign engineers A + B via `project_members`; **A sees the project, unassigned C gets 404 on its id**
(IDOR proof). A starts today's DSR; **B is routed to edit, not fill-then-fail.** A task goes past due
→ nightly job → **exactly one** `task.delayed` to admins + members; **re-running the job sends no
second notice.** Progress rolls up on a task update and **survives a concurrent sibling update.**
**A receives no self-notification** for their own DSR submit.


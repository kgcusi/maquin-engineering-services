# PMTIS — Project Status

> **Read this first.** Living progress + a map from "what you're building" to
> "which doc + file to open." Rules & conventions live in [`CLAUDE.md`](CLAUDE.md);
> the spec lives in [`docs/`](docs/) (where they conflict, **`docs/17` wins**).
>
> _Last updated: 2026-06-22 — **Stage 1 (Core System) marked complete** — all in-scope slices shipped; the only open items were deferred to Stage 2+ by decision. **Stage 2 spec adjusted ahead of build** — added `QA_QC_ENGINEER` (a third visible role) + on-request project scoping, flat multi-engineer teams (one LEAD + many MEMBERS), engineers now get scoped `task.manage` (create/assign tasks on assigned projects), and a deferred QA/QC inspection module; the client's PM workflow is mapped onto our roles/stages. Docs-only (`docs/02–05, 08, 14, 17`, `CLAUDE.md`); no Stage 2 code yet. Prior: **Notifications scaffold (core) landed** (`0010`: notifications + notification_settings, dispatcher, Vercel Cron drain, in-app bell, webmaster test panel; seeded inert). **Stage 0 gate closed** (live DB migrated · seeded · acceptance passed). **Directory** (clients/suppliers/employees CRUD + soft-delete) and a reusable **R2 file-upload pipeline** landed. **Employees** were then enriched toward HR/Payroll: detail page + Documents (typed: Contract/Gov ID/…) + Notes, plus position (creatable picker), employment type, date hired, address, and a pay **rate** (`0006`/`0007`; trade dropped). Also reconciled live-DB migration drift (applied the missing `0001` audit trigger; backfilled bookkeeping)._

---

## You are here

**Stage 0 — Foundation: ✅ COMPLETE.** The app boots, builds green (`typecheck` +
`lint` + `build` pass with Cache Components), and has auth/db/ui, the foundation
libs + schema, and the bootstrap seed in place. The **"Stage 0 full" gate is now
closed**: Neon is provisioned, all migrations applied, and the seed run (hidden
webmaster + admin) against the live DB, with the [`docs/16`](docs/16-tech-decisions.md)
§2 **acceptance check** passing — a multi-statement `db.transaction()` **and** a
prepared-heavy query both succeed against the **pooled** URL. Resend/R2/cron stay
deferred until the notifications/files features need them.

**Stage 1 — Core System: ✅ COMPLETE.** All slices shipped: the **auth session-caching layer**
(cookie cache + `getFreshSession` + optimistic `proxy.ts`), **User Management**
(admin CRUD + deactivate, audited, hidden webmaster filtered out), the
**Audit Log viewer** (`/audit`) — a filterable, paginated, read-only view over the
immutable `audit_logs` those actions already write — and **System Settings**
(`/settings`, **webmaster-only**): firm timezone + currency over `app_settings`, the
app's first `use cache` reader, with the timezone now applied across rendered
timestamps; the same page now stores **Resend email-delivery credentials** (sender +
API key) with a **connection test that sends no email** — but no app event triggers
a send yet (credentials-only on purpose). Brand assets (logos + adaptive favicon) are
wired into the shell.

The **Directory** is now in: **clients**, **suppliers**, and **employees** with
full CRUD, search, archive/restore (soft-delete), and an employee active toggle —
all audited. Clients have a detail page with **Info / Documents / Notes / Projects**
tabs, where Documents runs on a **reusable file-upload pipeline** (R2 presigned PUT →
direct browser upload → confirm) over the polymorphic `files`/`attachments` tables,
and Notes over the polymorphic `notes` table. The pipeline + `<FileUploader>` /
`<AttachmentList>` / `<NotesPanel>` are entity-agnostic, ready for DSR photos and
expense receipts in later stages.

The **Notifications scaffold (core)** has now landed — Stage 1's last item. The
deliver side is in: `notifications` + `notification_settings` tables (`0010`), a
data-driven **dispatcher** (drains the `outbox` → resolves `ROLE:*`/`USER:*`
recipients → creates rows; in-app appears immediately, email queues, deduped by
`idempotency_key`, every send audited), a `CRON_SECRET`-protected **Vercel Cron
drain** (`/api/cron/notifications` + `vercel.json`, every 5 min), a generic **React
Email** template (`src/emails/`), an **in-app bell** streamed into the topbar
(mark-read / mark-all), and a webmaster-only **"Send test notification"** panel in
Settings that runs the whole pipeline end-to-end. The `sendEmail()` path now uses
the **Settings-managed Resend key** (env fallback). Catalog is seeded **inert**
(`enabled=false`) — nothing emails real people until the firm enables an event.

**Deferred (by decision):** the Resend **webhook/Svix** handler (delivered/bounced/
complained), the **digest-aggregation** cron, **per-user preferences**, and wiring
**real domain events** — those land per-module in Stage 2+ as their sources arrive.

**Stage 1 is complete** — every in-scope slice shipped; the deferred items above are
by-design (their event sources don't exist until later stages), not blockers. **Up next —
Stage 2 (Project Tracking)**, whose spec was just refined: a third role `QA_QC_ENGINEER` +
on-request project scoping, flat multi-engineer teams (lead + members), engineers gain scoped
`task.manage`, and a deferred QA/QC inspection module ([`docs/17`](docs/17-audit-decisions.md)
§10 addendum). **No Stage 2 code yet** — `src/lib/{roles,permissions}.ts` and the
`project_members.role_on_project` enum still carry only the shipped values.

---

## Roadmap progress ([`docs/14`](docs/14-implementation-roadmap.md))

| Stage                   | Scope                                                                                                | Status                                                                                                                                                                                                                                                                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0 — Foundation**      | Scaffold, tooling, DB/auth, app shell, foundation libs/schema, seed                                  | ✅ **Complete** — migrated, seeded, acceptance passed (Resend/R2/cron deferred until needed)                                                                                                                                                                                                                                             |
| 1 — Core System         | Auth/RBAC, Audit, Settings, Notifications scaffold, Directory                                        | ✅ **Complete** — User Management + **Audit Log viewer** + **System Settings** + **Directory** (clients/suppliers/employees + **file-upload pipeline**) + **Notifications scaffold (core)** all shipped; deferred-by-decision items (Resend webhook, digest cron, real per-module event wiring) land in Stage 2+ as their sources arrive |
| 2 — Project Tracking    | Projects, Phases & Tasks, Daily Site Reports + **QA/QC role & scoping** (inspection module deferred) | ⬜ Not started — spec refined 2026-06-22 ([`docs/17`](docs/17-audit-decisions.md) §10 addendum)                                                                                                                                                                                                                                          |
| 3 — Inventory           | Ledger engine, stock-in, requests, release/receiving, movements                                      | ⬜ Not started                                                                                                                                                                                                                                                                                                                           |
| 4 — Finance             | Approvals (unified), Budgets, Expenses, Cash flow                                                    | ⬜ Not started                                                                                                                                                                                                                                                                                                                           |
| 5 — Reports & Dashboard | 12 reports + exports, dashboard, hardening, tests                                                    | ⬜ Not started                                                                                                                                                                                                                                                                                                                           |

---

## What's built (Stage 0 — code side)

- **Next.js 16** (App Router, Turbopack) with **Cache Components** (`cacheComponents: true`) — `next.config.ts`.
- **pnpm** · TypeScript · **Tailwind v4** · **shadcn** (Base UI / `base-nova`) + a deliberate engineering-green accent (green/white) · **Lucide**.
- **Better Auth** configured (admin plugin, **signup disabled**, `role`/`is_active`/`employee_id`) + **generated Drizzle auth schema** (`src/db/schema/auth.ts`) — `password` lives in `account` (not user).
- **Drizzle client** (`src/db/client.ts`: postgres-js, pooled, `prepare:false`, txn-capable) + `drizzle.config.ts` (unpooled).
- **App shell**: `/login` (double-submit-safe form), gated `/dashboard` (Suspense + fail-closed `AuthGate`), placeholder pages for projects/inventory/finance/reports, grouped sidebar/topbar, dark mode.
- **Auth-caching path** (DB-thrifty): Better Auth **cookie cache** (60s signed snapshot) so the read gate `getSession()` skips the DB; **`getFreshSession()`** (DB-authoritative) backs the `action()` write guard; optimistic **`src/proxy.ts`** (zero-DB cookie-presence redirect); `nextCookies()` wired last. Three layers: proxy (optimistic) → `AuthGate` (cached read) → `action()` (fresh DB on writes).
- **Tooling**: ESLint (+ `unused-imports` = no dead code) · Prettier · husky + lint-staged · `.claude/commands.json` · `.env.example`.
- **Folder skeleton** per [`docs/01`](docs/01-architecture.md) §4 (`src/modules/*`, `emails/`, `workers/`, `drizzle/migrations/`).
- **Foundation libs** (`src/lib/`): `rbac` (permission keys + roles + the `action()` Server-Action guard + the hidden **`WEBMASTER`** super-bundle / `HIDDEN_ROLES` + `visibleUserWhere`), `money` (Money VO + Drizzle money/quantity types), `events` (cache-tag taxonomy + outbox emitter), `audit`, `refcodes`, `mailer` (Resend), `storage` (R2 presign).
- **Foundation schema + migration** (`src/db/schema/`): `ref_counters`, `audit_logs` (+ append-only DB trigger), `outbox`, `files`, `attachments`, `notes` — `drizzle/migrations/0000`+`0001`+`0002` generated (**not yet applied**). `0002` widens `audit_logs.entity_id` to `text` (entity ids are heterogeneous: Better Auth text ids + our uuids).
- **Seed** (`src/db/seed.ts`): idempotent **hidden WEBMASTER** superuser + **ADMIN**, created from env (`SEED_WEBMASTER_*` / `SEED_ADMIN_*`) via `pnpm db:seed`.

## What's built (Stage 1 — code side)

- **User Management** (`src/modules/users/` + `/users`): admin **create / edit / deactivate / reactivate** through the guarded `action()` wrapper, every change **audited**; reads apply `visibleUserWhere()` so the hidden webmaster never appears; **deactivation deletes the user's `session` rows in-tx** (the deactivation-revoke contract). Built with **TanStack Table** + **react-hook-form** + Zod; designed empty/loading/error states; double-submit-safe.
- **Audit Log viewer** (`src/modules/audit/` + `/audit`): a **read-only**, server-paginated view over the append-only `audit_logs`. Searchable **Combobox** filters for actor + action, a Select for entity type, and **date pickers** for the range — all URL-driven so the page stays dynamic; newest-first, mobile-stacking filters + horizontally-scrollable table, with a per-row **diff** detail dialog. Action/entity keys render as **humanized labels** (`user.deactivated` → "User Deactivated", `src/modules/audit/labels.ts`). **No `action()` / Server Actions** — audit is written elsewhere, in-tx. Actor shows the real account and is **viewer-aware**: a webmaster viewer sees real names; for everyone else the hidden webmaster is masked as **"System"** and absent from the actor filter (preserves the hidden-superuser invariant). The reusable `getEntityAuditTrail()` query ships now for Stage 2+ per-entity "History" panels.
- **New shared UI primitives** (`src/components/ui/`): `Combobox` (searchable single-select on Base UI, shows the item **label** not its value) and `DatePicker` / `DateTimePicker` (a real **calendar popover** built on Base UI `Popover` + a hand-rolled month grid — no native date input, no extra deps; supports min/max, Today/Clear). Reuse these app-wide.
- **RBAC-in-UI**: topbar **sign-out** user-menu (streamed) + **permission-aware grouped sidebar nav** (the Setup section collapses away for engineers). Page-level gate `requirePagePermission()` (`src/lib/page-guards.ts`).
- **Authorization model split** for client/test safety: pure `src/lib/roles.ts` + `src/lib/permissions.ts` (no server deps) re-exported by `src/lib/rbac.ts` (which keeps the DB-coupled `action()` + `visibleUserWhere`). `action()` now maps `ActionError` to clean user-facing messages.
- **System Settings** (`src/modules/settings/` + `src/lib/settings.ts` + `/settings`): **webmaster-only** firm **timezone + currency** over the `app_settings` key/value table (migration `0004`). `getSettings()` is the app's **first `use cache` reader** (`cacheTag('settings')` / `cacheLife('max')`); `updateSettingsAction` upserts + audits (`settings.updated`) + invalidates **post-commit** (`revalidate`). Timezone threads through a pure `src/lib/datetime.ts` into the audit + users tables. `settings.view`/`settings.manage` are excluded from the ADMIN bundle (`WEBMASTER_ONLY`), so admins are redirected and the nav item is hidden.
- **Email-delivery credentials** (Settings → "Email delivery", **webmaster-only**, reusing `settings.manage`): Resend **sender + API key** stored as `app_settings` rows (no migration — key/value table) via `updateEmailSettingsAction`, plus a **`testEmailConnectionAction`** that validates the saved key with `resend.domains.list()` and **sends no email**. The API key is a **secret**: it never enters the cached `getSettings()` reader (a separate non-cached `getEmailConfig()` returns only a masked `re_••••wxyz` hint), is never echoed to the client (blank field = keep), and is **redacted in the audit diff**. Pure registry/masking in `src/lib/email-settings.ts`; the Resend probe lives in `src/lib/mailer.ts` (`checkResendConnection`). **Sending is intentionally NOT wired** — which events send email is an open decision to confirm with the firm before implementing.
- **Directory** (`src/modules/{clients,suppliers,employees}/` + `/clients`, `/suppliers`, `/employees`, **admin-gated**): full CRUD via the guarded `action()` wrapper, **search**, and a **Delete** — all **audited**; TanStack Table + react-hook-form + Zod; designed empty/loading states; double-submit-safe. All three entities behave identically: **Edit + Delete** only (no archive/restore UI). **Delete is a soft delete** under the hood (`deleted_at`, shared `DeleteConfirm`) so FK-referencing rows in later stages keep the name/history; deleted records are hidden from lists (no restore UI). Migration **`0005`** adds `clients`/`suppliers`/`employees`. **Clients** and **Employees** have detail pages (`/clients/[id]`, `/employees/[id]`) with tabs.
- **Employees — HR/Payroll foundation** (`0006`/`0007`): added `position` (a **creatable** searchable picker — pick existing or type new, `src/components/ui/creatable-combobox.tsx`), `employment_type`, `date_hired`, `address`, and a pay **`rate`** (DECIMAL(14,2) Money VO, exposed to the client as a plain string) with a `rate_unit` (Daily/Monthly/Hourly); **dropped `trade_code`**. `is_active` is kept in the DB **reserved** for the future HR module (employed vs separated) but is NOT surfaced in the UI — employees are Edit + Delete like the rest. Detail tabs: **Info / Documents / Notes**. Documents are **typed** (Contract / Government ID / Certificate / Resume / Other → `attachments.kind`, shown as a badge) via the same file pipeline (the `<FileUploader>` gained an optional `kinds` picker; clients still upload untyped).
- **Reusable file-upload pipeline** (`src/lib/uploads.ts` + `src/lib/storage.ts` + `src/modules/files/`): R2 **presign → direct browser PUT → confirm (HEAD)** over the polymorphic `files`/`attachments` tables; server-side mime allowlist + 15 MB cap; per-consumer guarded actions keep the static-permission `action()` invariant; entity-agnostic `<FileUploader>` / `<AttachmentList>` (+ `<NotesPanel>` over polymorphic `notes`) ready for DSR photos / receipts later. **Client documents are the first consumer.** End-to-end upload **verifies later** — needs **R2 provisioned + bucket CORS** (PUT from the app origin); the pure guards are unit-tested now.
- **Notifications scaffold — core** (`src/modules/notifications/` + `src/lib/notification-events.ts` + `src/emails/` + `0010`): a **data-driven** pipeline over the existing `outbox`. The `notifications` (status enum `QUEUED/SENT/DELIVERED/BOUNCED/COMPLAINED/FAILED/READ`, dedup `idempotency_key`, backoff) + `notification_settings` (per-event `enabled`/`channels`/`recipient_rule`/`mode`, seeded **inert**) tables land in `0010`. The **dispatcher** (`service.ts`, drained by **Vercel Cron** `/api/cron/notifications` + `vercel.json`, `CRON_SECRET`-guarded) resolves `ROLE:*`/`USER:*` recipients (`PROJECT:*` waits for Stage 2), creates rows (in-app appears immediately, email queues), and sends EMAIL via Resend — **deduped** and **audited** (`notification.sent`). A generic **React Email** template (`notification-email.tsx` + shared `layout.tsx`) with deep links; `sendEmail()` now uses the **Settings-managed Resend key** (env fallback). An **in-app bell** streams into the topbar (`notification-bell.tsx`, unread badge + mark-read / mark-all, `notification.view` for all roles) and a webmaster-only **"Send test notification"** panel runs the pipeline end-to-end. **Test-panel-only** by decision — nothing auto-emails until the firm enables an event. End-to-end email **verifies later** (needs Resend configured in Settings); dispatcher/bell/cron-auth are testable now.
- **Brand assets**: a `<Brand>` component (MQ **mark** / **horizontal** lockup; CSS light/dark swap isolated on the images so caller classes can't reveal both) wired into the sidebar, mobile login, and the (always-dark) auth panel; an **adaptive `app/icon.svg`** favicon (simplified MQ wordmark — the full logo mushes at tab size). Logos are fixed `public/` PNGs (R2 rejected for fixed assets).
- **Tests**: **Vitest** (`pnpm test`, 76 passing) — RBAC matrix incl. the webmaster-only settings gate (`src/lib/rbac.test.ts`), lookups/statuses units, the audit filter-schema unit, **settings registry + datetime** units, **email-credential masking + schema** units, **upload policy** (mime/size/key builder, `src/lib/uploads.test.ts`), **directory schema** units (clients/suppliers/employees incl. employee HR fields, rate, typed-document + note schemas), and **notifications** units (`src/modules/notifications/domain.test.ts` recipient-rule/idempotency/backoff/channels, `schema.test.ts`, `src/lib/notification-events.test.ts` catalog integrity).

Routes today: `/` → `/dashboard` (gated → `/login`); `/users`, `/audit`, `/clients`, `/clients/[id]`, `/suppliers`, `/employees`, `/employees/[id]` (admin-gated); `/settings` (webmaster-only). `(app)` pages render as Partial Prerender (◐); the optimistic `proxy.ts` redirects unauthenticated requests. Real HTTP routes: `/api/auth/[...all]` and the `CRON_SECRET`-guarded `/api/cron/notifications` drain.

## Stage 0 gate — ✅ CLOSED

Done against the live DB:

1. **Services provisioned** + `.env.local` filled: Neon (pooled + unpooled URLs), `BETTER_AUTH_SECRET`, `SEED_WEBMASTER_*` / `SEED_ADMIN_*`. Resend/R2/CRON still deferred until the notifications/files features need them.
2. **Migrated**: `pnpm db:migrate` applied (incl. `0001` audit append-only trigger), via the **unpooled** URL.
3. **Seeded**: `pnpm db:seed` created the hidden webmaster + admin; both sign in at `/login`.
4. **Acceptance check** ([`docs/16`](docs/16-tech-decisions.md) §2) passed: a multi-statement `db.transaction()` **and** a prepared-heavy query both succeed against the **pooled** URL.

_Ongoing per-stage (not a gate):_ the full domain schema ([`docs/02`](docs/02-data-model.md)) + modules land stage by stage, with **Vitest + Playwright** added alongside (ledger/money/rbac units + login e2e). The `stock_ledger` append-only trigger lands with Stage 3.

## How to run

```bash
pnpm install
cp .env.example .env.local   # then fill in values
pnpm dev                     # http://localhost:3000  (start it yourself; agents don't)
pnpm typecheck && pnpm lint && pnpm build
pnpm db:generate && pnpm db:migrate && pnpm db:seed
```

Command mapping for agents/hooks: [`.claude/commands.json`](.claude/commands.json).

---

## Where to look — "building X? read this"

| Building / touching…            | Read                                                                                                                          | Key files                                                                                                                 |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Anything (start here)           | [`docs/00`](docs/00-overview.md), [`docs/01`](docs/01-architecture.md), [`docs/17`](docs/17-audit-decisions.md)               | `CLAUDE.md`                                                                                                               |
| **Caching / `use cache` / PPR** | [`docs/16`](docs/16-tech-decisions.md) §7 + `node_modules/next/dist/docs/`                                                    | `next.config.ts`, `src/components/app-shell/auth-gate.tsx`                                                                |
| **DB schema / migrations**      | [`docs/02`](docs/02-data-model.md), [`docs/16`](docs/16-tech-decisions.md) §2                                                 | `src/db/schema/`, `drizzle.config.ts`, `src/db/client.ts`                                                                 |
| **Auth / sessions / users**     | [`docs/03`](docs/03-roles-and-permissions.md), [`docs/16`](docs/16-tech-decisions.md) §3                                      | `src/lib/auth.ts`, `src/lib/session.ts`, `src/lib/auth-client.ts`                                                         |
| **RBAC / Server Actions**       | [`docs/03`](docs/03-roles-and-permissions.md), [`docs/11`](docs/11-api-design.md), [`docs/17`](docs/17-audit-decisions.md) §5 | `src/lib/rbac.ts` _(Stage 1)_                                                                                             |
| **Inventory ledger**            | [`docs/06`](docs/06-inventory-ledger.md), [`docs/05`](docs/05-core-flows.md)                                                  | `src/modules/inventory/` _(Stage 3)_                                                                                      |
| **Finance / money**             | [`docs/07`](docs/07-finance-design.md)                                                                                        | `src/lib/money.ts`, `src/modules/finance/` _(Stage 4)_                                                                    |
| **Notifications / email**       | [`docs/08`](docs/08-notifications.md), [`docs/16`](docs/16-tech-decisions.md) §4,§6                                           | `src/modules/notifications/`, `src/lib/{mailer,notification-events}.ts`, `src/emails/`, `src/app/api/cron/notifications/` |
| **Files / uploads**             | [`docs/13`](docs/13-non-functional.md) §4, [`docs/16`](docs/16-tech-decisions.md) §5                                          | `src/lib/storage.ts` _(Stage 1)_                                                                                          |
| **Reports / dashboard**         | [`docs/09`](docs/09-reports-and-export.md), [`docs/10`](docs/10-dashboard.md)                                                 | `src/modules/reports/` _(Stage 5)_                                                                                        |
| **Audit trail**                 | [`docs/12`](docs/12-audit-trail.md)                                                                                           | `src/lib/audit.ts` _(Stage 1)_                                                                                            |

## Invariants — do not break (full list in `CLAUDE.md`)

- **Driver**: app → `postgres-js` pooled `prepare:false`; migrations → unpooled; **never** `neon-http`.
- **Dynamic by default**; `use cache` only for settings + admin report aggregates; session reads stay out of cache and inside `<Suspense>`.
- **All mutations** go through the guarded `action()` Server Action wrapper. No public signup.
- **Session reads:** the cookie cache (60s) serves the **read** gate; the `action()` **write** guard uses `getFreshSession()` (fresh DB). **Deactivation-revoke contract (implemented):** `deactivateUserAction` deletes the target's `session` rows in the same transaction, so a cached cookie can't outlive a disabled account beyond 60s (docs/17 §3). Any future user-disabling path must do the same.
- **Ledger & audit log are append-only**; money is `DECIMAL(14,2)`, never float.
- Double-submit safety, designed empty/loading/error states, no dead code.

---

_When you finish a chunk of work, update [You are here](#you-are-here) and the
roadmap table so this file stays the source of truth for project progress._

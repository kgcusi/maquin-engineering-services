# PMTIS — Project Status

> **Read this first.** Living progress + a map from "what you're building" to
> "which doc + file to open." Rules & conventions live in [`CLAUDE.md`](CLAUDE.md);
> the spec lives in [`docs/`](docs/) (where they conflict, **`docs/17` wins**).
>
> _Last updated: 2026-06-15 — Stage 0 code-side complete (foundation libs, schema, seed)._

---

## You are here

**Stage 0 — Foundation (code side): ✅ COMPLETE.** The app boots, builds green
(`typecheck` + `lint` + `build` pass with Cache Components), and has auth/db/ui,
the foundation libs + schema, and the bootstrap seed in place. **No external
services are wired yet** — everything here is code-only; the migration is
generated but not applied.

The immediate next step is the **"Stage 0 full" gate** (provision services, migrate,
seed, prove the transaction invariant) — see [Next gate](#next-gate) below. Then
Stage 1 feature work.

---

## Roadmap progress ([`docs/14`](docs/14-implementation-roadmap.md))

| Stage                   | Scope                                                               | Status                                                                 |
| ----------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **0 — Foundation**      | Scaffold, tooling, DB/auth, app shell, foundation libs/schema, seed | 🟡 **Code-side done**; pending live services + migrate/seed/acceptance |
| 1 — Core System         | Auth/RBAC, Audit, Settings, Notifications scaffold, Directory       | ⬜ Not started                                                         |
| 2 — Project Tracking    | Projects, Phases & Tasks, Daily Site Reports                        | ⬜ Not started                                                         |
| 3 — Inventory           | Ledger engine, stock-in, requests, release/receiving, movements     | ⬜ Not started                                                         |
| 4 — Finance             | Approvals (unified), Budgets, Expenses, Cash flow                   | ⬜ Not started                                                         |
| 5 — Reports & Dashboard | 12 reports + exports, dashboard, hardening, tests                   | ⬜ Not started                                                         |

---

## What's built (Stage 0 — code side)

- **Next.js 16** (App Router, Turbopack) with **Cache Components** (`cacheComponents: true`) — `next.config.ts`.
- **pnpm** · TypeScript · **Tailwind v4** · **shadcn** (Base UI / `base-nova`) + a deliberate "blueprint blue" accent · **Lucide**.
- **Better Auth** configured (admin plugin, **signup disabled**, `role`/`is_active`/`employee_id`) + **generated Drizzle auth schema** (`src/db/schema/auth.ts`) — `password` lives in `account` (not user).
- **Drizzle client** (`src/db/client.ts`: postgres-js, pooled, `prepare:false`, txn-capable) + `drizzle.config.ts` (unpooled).
- **App shell**: `/login` (double-submit-safe form), gated `/dashboard` (Suspense + fail-closed `AuthGate`), placeholder pages for projects/inventory/finance/reports/settings, sidebar/topbar, dark mode.
- **Tooling**: ESLint (+ `unused-imports` = no dead code) · Prettier · husky + lint-staged · `.claude/commands.json` · `.env.example`.
- **Folder skeleton** per [`docs/01`](docs/01-architecture.md) §4 (`src/modules/*`, `emails/`, `workers/`, `drizzle/migrations/`).
- **Foundation libs** (`src/lib/`): `rbac` (permission keys + roles + the `action()` Server-Action guard + the hidden **`WEBMASTER`** super-bundle / `HIDDEN_ROLES` + `visibleUserWhere`), `money` (Money VO + Drizzle money/quantity types), `events` (cache-tag taxonomy + outbox emitter), `audit`, `refcodes`, `mailer` (Resend), `storage` (R2 presign).
- **Foundation schema + migration** (`src/db/schema/`): `ref_counters`, `audit_logs` (+ append-only DB trigger), `outbox`, `files`, `attachments`, `notes` — `drizzle/migrations/0000`+`0001` generated (**not yet applied**).
- **Seed** (`src/db/seed.ts`): idempotent **hidden WEBMASTER** superuser + **ADMIN**, created from env (`SEED_WEBMASTER_*` / `SEED_ADMIN_*`) via `pnpm db:seed`.

Routes today: `/` → `/dashboard` (gated → `/login`). `(app)` pages render as Partial Prerender (◐).

<a id="next-gate"></a>

## Next gate — do this before Stage 1 feature work

1. **Provision services** and fill `.env.local` (copy `.env.example`): Neon (pooled + unpooled URLs), `BETTER_AUTH_SECRET`, `SEED_WEBMASTER_*` / `SEED_ADMIN_*`; later Resend/R2/CRON.
2. **Migrate**: `pnpm db:migrate` — applies `0000` (tables) + `0001` (audit append-only trigger), via the **unpooled** URL.
3. **Seed**: `pnpm db:seed` → creates the hidden webmaster + admin; confirm both sign in at `/login`.
4. **Acceptance check** ([`docs/16`](docs/16-tech-decisions.md) §2): prove a multi-statement `db.transaction()` **and** a prepared-heavy query both succeed against the **pooled** URL.
5. **Full domain schema** ([`docs/02`](docs/02-data-model.md)) + per-stage modules; add **Vitest + Playwright** (ledger/money/rbac units + login e2e). The `stock_ledger` append-only trigger lands with Stage 3.

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

| Building / touching…            | Read                                                                                                                          | Key files                                                         |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Anything (start here)           | [`docs/00`](docs/00-overview.md), [`docs/01`](docs/01-architecture.md), [`docs/17`](docs/17-audit-decisions.md)               | `CLAUDE.md`                                                       |
| **Caching / `use cache` / PPR** | [`docs/16`](docs/16-tech-decisions.md) §7 + `node_modules/next/dist/docs/`                                                    | `next.config.ts`, `src/components/app-shell/auth-gate.tsx`        |
| **DB schema / migrations**      | [`docs/02`](docs/02-data-model.md), [`docs/16`](docs/16-tech-decisions.md) §2                                                 | `src/db/schema/`, `drizzle.config.ts`, `src/db/client.ts`         |
| **Auth / sessions / users**     | [`docs/03`](docs/03-roles-and-permissions.md), [`docs/16`](docs/16-tech-decisions.md) §3                                      | `src/lib/auth.ts`, `src/lib/session.ts`, `src/lib/auth-client.ts` |
| **RBAC / Server Actions**       | [`docs/03`](docs/03-roles-and-permissions.md), [`docs/11`](docs/11-api-design.md), [`docs/17`](docs/17-audit-decisions.md) §5 | `src/lib/rbac.ts` _(Stage 1)_                                     |
| **Inventory ledger**            | [`docs/06`](docs/06-inventory-ledger.md), [`docs/05`](docs/05-core-flows.md)                                                  | `src/modules/inventory/` _(Stage 3)_                              |
| **Finance / money**             | [`docs/07`](docs/07-finance-design.md)                                                                                        | `src/lib/money.ts`, `src/modules/finance/` _(Stage 4)_            |
| **Notifications / email**       | [`docs/08`](docs/08-notifications.md), [`docs/16`](docs/16-tech-decisions.md) §4,§6                                           | `src/lib/mailer.ts`, `src/emails/`, `src/workers/` _(Stage 1+)_   |
| **Files / uploads**             | [`docs/13`](docs/13-non-functional.md) §4, [`docs/16`](docs/16-tech-decisions.md) §5                                          | `src/lib/storage.ts` _(Stage 1)_                                  |
| **Reports / dashboard**         | [`docs/09`](docs/09-reports-and-export.md), [`docs/10`](docs/10-dashboard.md)                                                 | `src/modules/reports/` _(Stage 5)_                                |
| **Audit trail**                 | [`docs/12`](docs/12-audit-trail.md)                                                                                           | `src/lib/audit.ts` _(Stage 1)_                                    |

## Invariants — do not break (full list in `CLAUDE.md`)

- **Driver**: app → `postgres-js` pooled `prepare:false`; migrations → unpooled; **never** `neon-http`.
- **Dynamic by default**; `use cache` only for settings + admin report aggregates; session reads stay out of cache and inside `<Suspense>`.
- **All mutations** go through the guarded `action()` Server Action wrapper. No public signup.
- **Ledger & audit log are append-only**; money is `DECIMAL(14,2)`, never float.
- Double-submit safety, designed empty/loading/error states, no dead code.

---

_When you finish a chunk of work, update [You are here](#you-are-here), the
roadmap table, and the [Next gate](#next-gate) list so this file stays the source
of truth for project progress._

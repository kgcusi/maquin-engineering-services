@AGENTS.md

# PMTIS — Project Agent Guide

Project Management, Tracking & Inventory System — an internal web app for a
construction & engineering firm (admin + field engineers). This file is the
project-specific agent guide; it **complements** the user's global
`~/.claude/CLAUDE.md` (global rules still apply) and the bundled Next.js rules in
`@AGENTS.md`. When this file and the docs conflict, **`docs/17-audit-decisions.md`
wins**, then `docs/16`, then `docs/01`.

> ⚠️ **Next.js 16 + React 19** — APIs differ from older training data. Before
> writing framework code, read the relevant guide in
> `node_modules/next/dist/docs/` (e.g. `use-cache.md`, `cacheComponents.md`).

## Locked stack (do not swap — `docs/16`)

| Concern                     | Choice                                                                                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Host / framework            | Vercel Fluid Compute (Node 24) · **Next.js 16** App Router, Server Actions, **Cache Components** (`cacheComponents: true`) |
| Language                    | TypeScript end-to-end                                                                                                      |
| DB / ORM                    | **Neon Postgres** · **Drizzle ORM + Drizzle Kit**                                                                          |
| Auth                        | **Better Auth** (Drizzle adapter, admin plugin, signup disabled)                                                           |
| UI                          | **Tailwind v4** + **shadcn** (Base UI / `base-nova`) + **Lucide**                                                          |
| Forms / tables / validation | react-hook-form · TanStack Table · **Zod** (shared with Server Actions)                                                    |
| Email                       | **Resend** + **React Email** (`src/emails/`)                                                                               |
| Files                       | **Cloudflare R2** (S3-compatible, presigned PUT/GET)                                                                       |
| Jobs                        | **Vercel Cron** draining a DB outbox (`src/workers/`)                                                                      |
| Exports / charts            | React-PDF · ExcelJS · csv-stringify · Recharts                                                                             |
| Tests                       | Vitest · Playwright                                                                                                        |

Package manager is **pnpm** (only). Run project commands via `.claude/commands.json`.

## The driver invariant (most important infra detail)

The inventory ledger needs multi-statement transactions, so:

- App runtime → `drizzle-orm/postgres-js` against the **POOLED** `DATABASE_URL`,
  with **`postgres({ prepare: false })`** (Neon pooled = PgBouncer txn mode).
  See `src/db/client.ts`.
- Drizzle Kit (generate/migrate/studio) → the **UNPOOLED** `DATABASE_URL_UNPOOLED`.
  See `drizzle.config.ts`.
- **Never** `drizzle-orm/neon-http` — it cannot do interactive transactions and
  silently breaks ledger atomicity.

## Caching policy (Cache Components — `docs/16` §7)

- **Dynamic by default.** Internal, auth-scoped, mutation-heavy. The whole
  `(app)` shell, approval queues, balances, and cash position stay dynamic.
- **Opt into `use cache`** only for non-user-scoped, slow-changing reads: System
  Settings / lookup tables and admin firm-wide report aggregates. Tag them
  (`cacheTag('settings')`, …) with `cacheLife`.
- Anything reading the session (cookies/headers) must stay **out of `use cache`**
  and live inside a `<Suspense>` boundary (see `src/components/app-shell/auth-gate.tsx`).
- Invalidate **synchronously in the Server Action after commit** via the event
  bus (`revalidateTag`/`updateTag`) — never via the async outbox. Tag taxonomy:
  `settings`, `project:{id}:budget`, `project:{id}:materials`,
  `project:{id}:progress`, `dashboard:{userId}`.

## Conventions (`docs/00` §7)

- **DB:** `snake_case`, **plural** table names; PK `id`; FK `<entity>_id`;
  `created_at`/`updated_at`/`deleted_at`. Exception: Better Auth core tables are
  **singular** (`user`/`session`/`account`/`verification`) — leave them as-is.
- **Money:** `DECIMAL(14,2)` + a `Money` value object; never floats.
  **Quantities:** `DECIMAL(14,3)`. Ref codes like `MR-2026-00042` (server-side).
- **Time:** store UTC, render in firm-local. **Code:** camelCase / PascalCase.

## Firm rules (enforced)

- **No public signup** — accounts are admin-provisioned (`disableSignUp`, admin plugin, seed).
- **Roles** (`src/lib/rbac.ts`): `ADMIN`/`ENGINEER`/`QA_QC_ENGINEER` (visible) + **`WEBMASTER`** — a hidden superuser with every permission, **never shown in any user listing** (managed only via the seed/DB). Two non-negotiables: keep `WEBMASTER` in `HIDDEN_ROLES` and apply `visibleUserWhere` to every user list/count/picker; and do **NOT** add `WEBMASTER` to Better Auth `adminRoles` (a novel role fails Better Auth's validation and breaks the build). Authorization is ours — WEBMASTER's power comes from `ROLE_PERMISSIONS`; provisioning uses the no-headers `auth.api.createUser` bypass. `QA_QC_ENGINEER` (added Stage 2 — `docs/17` §10 addendum) is a **non-admin** role like `ENGINEER`: keep it **out** of Better Auth `adminRoles` (`defaultRole` stays `ENGINEER`); its inspection-only power comes from `ROLE_PERMISSIONS`, and its project visibility is granted on inspection request (`project_members.role_on_project = 'INSPECTOR'`).
- **All mutations go through one guarded Server Action wrapper** (`action(permissionKey, zodSchema, fn)` — Stage 1). Real HTTP routes only for: file signed-URLs, cron, the Resend webhook, export downloads (`docs/17` §3). An unguarded Server Action is a public POST.
- **Double-submit safety:** every mutating control disables while in flight (see the login form's `useTransition` pattern).
- **Designed empty / loading / error states** everywhere — no bare "No data".
- **No dead code / no commented-out blocks / no unused imports** (ESLint `unused-imports` enforces it; `src/components/ui/**` is exempt — shadcn-owned).
- Server-side authorization on every request; engineers scoped to their projects at the **query** level.

## Layout (`docs/01` §4)

`src/db/{client.ts,schema/,seed.ts}` · `src/lib/{auth,rbac,events,mailer,storage,money,refcodes,audit}.ts`
· `src/app/(auth|app)/…` + `src/app/api/…` · `src/modules/<area>/{service,domain,schema,queries}.ts`
· `src/emails/` · `src/components/` · `src/workers/`. Cross-module calls go
**service → service**, never into another module's internals.

## Status — Stage 0 code-side DONE; this is the next gate

Done now: pnpm + Next 16 (cacheComponents) · Tailwind v4 + shadcn · Better Auth
config + generated auth schema · Drizzle client (pooled, prepare:false) +
`drizzle.config` (unpooled) · app shell (login, gated dashboard, placeholders) ·
tooling (eslint/prettier/husky) · `.env.example` · **foundation libs**
(`rbac`/`money`/`events`/`audit`/`refcodes`/`mailer`/`storage`) · **foundation
schema + migration** (`ref_counters`/`audit_logs`+trigger/`outbox`/`files`/
`attachments`/`notes`) · **seed** (hidden `WEBMASTER` + `ADMIN`). See `STATUS.md`.

**Deferred — the next gate (do before feature work, see `docs/14` Stage 0):**

- Provision Neon/Resend/R2; fill `.env.local`; run `pnpm db:migrate`; `pnpm db:seed` (creates the hidden webmaster + admin).
- **Acceptance check** (`docs/16` §2): a multi-statement `db.transaction()` **and** a prepared-heavy query both succeed against the **pooled** URL.
- Full `docs/02` domain schema + per-stage modules; Vitest + Playwright (ledger/money/rbac + login e2e). The `stock_ledger` append-only trigger lands in Stage 3.

## Doc map

`00` overview/glossary · `01` architecture · `02` data model · `03` roles/permissions
· `04` modules · `05` flows · `06` ledger · `07` finance · `08` notifications
· `09` reports · `10` dashboard · `11` API · `12` audit · `13` non-functional
· `14` roadmap · `15` future · `16` **tech decisions (locked)** · `17` **audit decisions (supersede 00–16)**.

## Subagents

Reuse the global subagents (`planner`, `reviewer`, `migrator`, `ui-builder`,
`debugger`) — the migrator is the right call for the per-stage Drizzle schema
work. No project-specific subagents are defined; this guide is the shared context
they should honor.

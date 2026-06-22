# 16 — Tech Decisions (Locked)

The agreed stack, why, and the integration notes/gotchas that matter when building. This is the
canonical record; [01-architecture.md](01-architecture.md) reflects it.

## 1. The stack

| Concern | Decision | Notes |
|---------|----------|-------|
| Hosting | **Vercel (managed)** | Fluid Compute (Node 24), 300s timeouts, warm instances |
| Framework | **Next.js 16** — App Router, Server Actions, Cache Components (PPR) | `cacheComponents: true` |
| Language | **TypeScript** end to end | |
| Database | **Neon Postgres** (Vercel Marketplace) | auto-provisions `DATABASE_URL` |
| ORM | **Drizzle ORM** + **Drizzle Kit** | chosen for cross-project consistency; SQL-first fits the ledger/reports |
| Auth | **Better Auth** (Drizzle adapter) | email/password + DB sessions; admin-provisioned |
| Styling | **Tailwind v4** + **shadcn** + **Lucide** icons | |
| Tables / forms | **TanStack Table** + **react-hook-form** + **Zod** | Zod schemas shared with Server Actions |
| Email | **Resend** + **React Email** | transactional email; React components as templates |
| File storage | **Cloudflare R2** (S3-compatible) | cross-project consistency; presigned URLs |
| Background jobs | **Vercel Cron** + DB **outbox/job table** | no long-running worker on serverless |
| Charts | **Recharts** | dashboard widgets |
| Exports | **ExcelJS** / **csv-stringify** / **React-PDF** | reports → Excel / CSV / PDF |
| Testing | **Vitest** + **Playwright** | critical-flow coverage |

> Everything in [02](02-data-model.md)–[15](15-future-enhancements.md) (data model, modules,
> flows, ledger, finance, roadmap) is unchanged by these choices — they describe *what* the
> system does; this doc fixes *what we build it with*.

## 2. Drizzle — and the transaction gotcha that matters most

- **Schema as TypeScript** (`pgTable(...)`) under `src/db/schema/`, migrations via **Drizzle
  Kit** (`drizzle-kit generate` / `migrate`). The field tables in [02](02-data-model.md) map
  directly to Drizzle column builders.
- SQL-first ergonomics suit our two hardest read paths: the **inventory ledger** running-balance
  queries ([06](06-inventory-ledger.md)) and the **report aggregations** ([09](09-reports-and-export.md)).
  Drizzle's relational queries cover the CRUD; drop to `sql\`\`` for the heavy analytical views.

> ### ⚠️ Use a transaction-capable driver
> The ledger **requires multi-statement transactions** (post N ledger rows + update balances +
> write the approval + audit, all atomically — [06](06-inventory-ledger.md) §5). On Neon:
> - ✅ `drizzle-orm/postgres-js` (TCP, pooled) **or** `drizzle-orm/neon-serverless` (WebSocket
>   pool) — **both support `db.transaction()`**.
> - ❌ `drizzle-orm/neon-http` — the HTTP driver **cannot do interactive multi-statement
>   transactions**. Do **not** use it for the app's write path.
>
> Recommendation: **`postgres-js` against Neon's pooled connection string** for the app, and the
> direct (unpooled) URL for Drizzle Kit migrations. This is the single most important infra
> detail in the build — getting it wrong silently breaks ledger atomicity.
>
> **And set `postgres({ prepare: false })`.** Neon's pooled endpoint is PgBouncer in *transaction*
> mode, which breaks prepared statements (postgres-js prepares by default). Without this you get
> intermittent runtime errors under load, not at build time. (Or use `neon-serverless`, which
> handles this on Fluid Compute.) Stage 0 acceptance check: a multi-statement `db.transaction()`
> **and** a prepared-heavy query both succeed against the pooled URL.

## 3. Better Auth — integration plan

- **Adapter:** Better Auth's Drizzle adapter. It owns `user`, `session`, `account`,
  `verification` tables; the CLI generates them into our Drizzle schema.
- **Extend the user model** with our fields: `role` (`ADMIN`/`ENGINEER`/`QA_QC_ENGINEER`), `is_active`,
  `employee_id`. The domain tables in [02](02-data-model.md) that reference `users.id` point at
  Better Auth's user row.
- **No public signup:** disable `signUp`; provision accounts via the **`admin` plugin**
  (`createUser`, list, ban/unban, set-role, impersonate) — matches [04](04-modules.md) §5.1.
- **Sessions:** DB sessions; read with `auth.api.getSession({ headers })` inside Server
  Components/Actions to feed the RBAC guard. `is_active = false` ⇒ deny.
- **Authorization stays ours.** Better Auth = authentication only. Permission keys, the
  `ROLE_PERMISSIONS` **static code map** (not a `role_permissions` table — [17](17-audit-decisions.md)
  §1), and the **project-scoping helper** ([03](03-roles-and-permissions.md)) live in our code.
  Optional security add-ons we get cheaply: **2FA**, **rate limiting**, **account lockout** plugins.
- **Caching:** anything that reads the session is **dynamic** (cookies/headers) — keep it out of
  `use cache`. Consistent with [01](01-architecture.md) §8 and the caching plan.

## 4. Resend + React Email

- **Templates are React Email components** (`@react-email/components`) under
  `src/emails/`, rendered to HTML server-side and sent via the **Resend SDK**. Type-safe
  props replace the old `{{handlebars}}` idea in [08](08-notifications.md) §5.
- **"SMTP" requirement:** the proposal said SMTP; Resend satisfies transactional email and
  *also* exposes an **SMTP endpoint** (`smtp.resend.com`) if a true SMTP protocol is ever
  contractually required. Default to the **Resend API** (cleaner, pairs with React Email).
- **Deliverability:** verify the firm's sending domain in Resend (SPF/DKIM/DMARC). `EMAIL_FROM`
  uses that domain.
- **Delivery status via webhooks:** Resend webhooks (`delivered`, `bounced`, `complained`)
  update `notifications.status` — better than guessing. Feeds the notification-health view
  ([13](13-non-functional.md) §7).
- **Idempotency:** the dispatcher de-dupes ([08](08-notifications.md) §8); Resend also accepts an
  idempotency key on send.
- **Local/dev:** use a Resend test API key / sandbox domain so no real mail goes to clients.

## 5. Cloudflare R2

- **S3-compatible:** access via `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` pointed
  at the R2 endpoint. The `storage.ts` adapter ([01](01-architecture.md) §4) hides this; the
  `files` table ([02](02-data-model.md) §8.1) is unchanged.
- **Direct browser → R2 uploads** via **presigned PUT** — DSR photos and receipts upload
  straight to R2 without streaming through a Function (saves bandwidth/timeout headroom). The
  Function only issues the presigned URL and records `files` metadata on completion.
- **Reads via presigned GET** (short-lived), authorized against the requester's scope.
- **Guards:** mime allowlist + size cap enforced when issuing the presigned URL and validated on
  the metadata record ([13](13-non-functional.md) §4).

## 6. Background jobs on serverless (important shift)

Serverless has **no always-on worker**, so the notification design ([08](08-notifications.md))
runs as **Vercel Cron routes that drain a DB outbox/job table**:

| Job | Cadence (suggested) | Does |
|-----|--------------------|------|
| Outbox drain / email retry | every 1–5 min | send `QUEUED`/`FAILED` notifications via Resend |
| Delay check | daily | flag overdue tasks, emit `task.delayed` |
| Low-stock scan | hourly/daily | compare balances vs reorder level, emit `stock.low` |
| Digests | daily (configurable) | aggregate per-recipient summary emails |
| Ledger reconciliation | daily/weekly | rebuild balances from ledger, report drift ([06](06-inventory-ledger.md) §4) |

Protect cron endpoints with `CRON_SECRET`. Each run is short (well within Fluid Compute's 300s);
batch large workloads across runs.

## 7. Caching plan (recap, decided)

Dynamic-by-default for this internal app; cache narrowly:

- **`use cache`** for **System Settings (`app_settings`)** and **admin firm-wide report
  aggregates** — not user-scoped, change rarely. Tag them (`cacheTag('settings')`, etc.).
  (Option lists are code constants — no DB read, nothing to cache; [17](17-audit-decisions.md) §9.)
- **PPR (Cache Components)**: static app shell + `<Suspense>`-streamed dynamic widgets
  ([10](10-dashboard.md)).
- **Invalidate via the event bus**: domain events ([08](08-notifications.md)) call
  `revalidateTag` / `updateTag` (e.g. `expense.approved` → refresh that project's budget tag).
- **Never** time-cache operational/auth-scoped data (approval queue, balances, cash position) —
  keep dynamic, invalidate on write.

## 8. Environment variables (consolidated)

```
# App
APP_BASE_URL=
APP_TIMEZONE=Asia/Manila      # adjust to the firm
APP_CURRENCY=PHP              # single base currency

# Database — Neon (Vercel Marketplace)
DATABASE_URL=                 # pooled, transaction-capable (postgres-js)
DATABASE_URL_UNPOOLED=        # direct, for Drizzle Kit migrations

# Auth — Better Auth
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=              # = APP_BASE_URL

# Email — Resend
RESEND_API_KEY=
EMAIL_FROM=                   # "PMTIS <no-reply@firm.com>" on a verified domain

# Storage — Cloudflare R2
R2_ENDPOINT=                  # https://<account>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=

# Cron protection
CRON_SECRET=
```

## 9. Decision log

| Decision | Rationale |
|----------|-----------|
| Vercel managed | Fast path, least ops; Fluid Compute = full Node for ledger/SMTP |
| Next.js 16 + Server Actions | Mutations map onto the service layer; PPR for dashboard UX |
| **Drizzle** (not Prisma) | Consistency with the firm's other projects; SQL-first suits ledger/reports |
| **Better Auth** (not Clerk/Auth.js) | Own auth in our DB, email/password + admin provisioning, no per-MAU cost |
| **Resend + React Email** | Transactional email with type-safe React templates; SMTP endpoint available |
| **Cloudflare R2** | Consistency with the firm's other projects; S3-compatible, presigned uploads |
| Cron-drained outbox | Serverless has no long-running worker |
| Dynamic-by-default caching | Internal, auth-scoped, mutation-heavy app — cache only settings/reports |

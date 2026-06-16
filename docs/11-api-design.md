# 11 — API Design

Whether implemented as REST route handlers, Next.js server actions, or a mix, these
conventions hold. The goal: predictable, validated, authorized, attributable endpoints.

## 1. Conventions

- **Resources are plural, kebab-case:** `/api/material-requests`, `/api/daily-reports`,
  `/api/stock-ins`.
- **Standard verbs:** `GET` (list/read), `POST` (create), `PATCH` (partial update), `DELETE`
  (soft-delete/cancel where allowed).
- **Actions that aren't CRUD** are sub-resources or explicit verbs:
  `POST /api/material-requests/:id/approve`, `POST /api/releases`,
  `POST /api/expenses/:id/approve`, `POST /api/daily-reports/:id/submit`.
- **IDs** in paths; filters in query string (`?projectId=&status=&from=&to=&page=&pageSize=`).
- **Every mutation:** authenticate → authorize (RBAC + scope) → validate (Zod) → service call
  (transaction) → emit events → return shaped result.

## 2. Resource map (representative)

| Resource | Endpoints | Notes |
|----------|-----------|-------|
| auth | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` | session cookie |
| users | `GET/POST /users`, `PATCH /users/:id`, `POST /users/:id/deactivate` | admin |
| settings | `GET/PATCH /settings`, `CRUD /settings/lookups/:list` | admin |
| audit | `GET /audit-logs` | admin, filters |
| employees | `CRUD /employees` | |
| clients | `CRUD /clients`, `/clients/:id/documents`, `/clients/:id/notes` | |
| suppliers | `CRUD /suppliers` | |
| projects | `CRUD /projects`, `GET /projects/:id` (hub) | scope-filtered |
| phases | `CRUD /projects/:id/phases` | |
| tasks | `CRUD /phases/:id/tasks`, `PATCH /tasks/:id/progress` | |
| daily-reports | `GET/POST /projects/:id/daily-reports`, `POST /daily-reports/:id/submit` | |
| budgets | `GET/POST /projects/:id/budgets`, `POST /budgets/:id/revise` | |
| expenses | `CRUD /expenses`, `POST /expenses/:id/approve`, `/reject`, `/pay` | |
| cashflow | `CRUD /cashflow` | |
| approvals | `GET /approvals`, `POST /approvals/:id/approve`, `/reject` | admin |
| items | `CRUD /items` | |
| locations | `CRUD /locations` | |
| stock-ins | `GET/POST /stock-ins` | |
| material-requests | `CRUD /material-requests`, `POST /:id/approve`, `/reject` | |
| releases | `POST /releases`, `GET /releases/:id` | |
| site-receipts | `POST /releases/:id/receipts` | |
| movements | `GET/POST /inventory-movements`, `POST /:id/approve` | |
| ledger | `GET /inventory-ledger` (by item/location/project) | read-only |
| reports | `GET /reports/:key`, `GET /reports/:key/export?format=` | scoped |
| dashboard | `GET /dashboard` | role-aware |
| files | `POST /files` (upload), `GET /files/:id/url` (signed) | |
| notifications | `GET /notifications`, `POST /:id/read`, `GET/PATCH /notification-settings` | |

## 3. Validation

- One **Zod schema per input** in the module's `schema.ts`; reused for both API validation and
  client form validation (single source of truth).
- Validate **types, ranges, and references** at the boundary (e.g. qty ≥ 0, amount ≥ 0, valid
  enum, existing FK). Business invariants (sufficient stock, valid state transition) are checked
  in the service/domain layer.
- Reject unknown fields; coerce/normalize (trim strings, parse dates to UTC).

## 4. Responses & errors

- **Success:** `{ data: ... }` (+ `{ meta: { page, pageSize, total } }` for lists).
- **Error:** consistent envelope `{ error: { code, message, fields? } }` with proper HTTP
  status:
  - `400` validation, `401` unauthenticated, `403` forbidden/out-of-scope, `404` not found,
    `409` conflict (e.g. duplicate DSR for the date, insufficient stock), `422` business-rule
    violation, `500` unexpected.
- Validation errors return per-field messages for the form to display.
- No stack traces or internal details leak to clients; full detail goes to server logs.

## 5. Idempotency & double-submit safety

- Mutation endpoints guard against duplicates (matches the firm's form-submission rule): a
  unique constraint where natural (`daily_reports(project_id, report_date)`), and/or an
  idempotency key for create endpoints prone to double-click.
- The UI disables submit while in-flight; the **server** is still the source of truth — never
  rely on the client alone.
- Reference-code generation is transactional ([01](01-architecture.md) §5.6) so concurrent
  creates don't collide.

## 6. Pagination, filtering, sorting

- List endpoints: `?page=&pageSize=` (cap pageSize), `?sort=field:dir`, plus resource filters.
- Default sensible sort (newest first) and a hard max page size to protect the DB.

## 7. Files

- `POST /files` streams to object storage, returns `{ id }`; the entity then references
  `file_id`. Enforce mime allowlist + size cap server-side.
- `GET /files/:id/url` returns a short-lived signed URL; access checked against the requester's
  scope.

## 8. Security recap (full in [13](13-non-functional.md))

- Auth on every endpoint; RBAC + project scope enforced server-side.
- Parameterized queries via the ORM; no string-built SQL.
- Rate-limit auth and other abuse-prone endpoints.
- CSRF protection on cookie-based mutations.
- Audit-log sensitive mutations ([12](12-audit-trail.md)).

# 13 — Non-Functional Requirements

The qualities the system must have regardless of features. For an internal tool that handles
the firm's money and materials, **security, integrity, and recoverability** matter more than
raw scale.

## 1. Security

### Authentication
- Passwords hashed by **Better Auth** (scrypt by default), stored in `account.password`. No plaintext, ever.
- Sessions in **HTTP-only, Secure, SameSite** cookies; reasonable expiry + idle timeout.
- Rate-limit and lock out repeated failed logins; log them ([12](12-audit-trail.md)).
- No public sign-up; admin-provisioned accounts only. Deactivate, never expose deletion.

### Authorization
- RBAC + project scope checked **server-side on every request** ([03](03-roles-and-permissions.md)).
- Engineers filtered to assigned projects at the **query** level. Hiding UI is not security.
- Authorization failures → `403`, optionally audited; never silently degrade.

### Input & data safety
- Validate all input with Zod at the boundary; reject unknown fields.
- ORM/parameterized queries only — no string-concatenated SQL (prevents injection).
- Output-encode user content in the UI (React handles most; be careful with any raw HTML).
- CSRF protection on cookie-based mutations.
- Sensible security headers (CSP, HSTS, X-Content-Type-Options, frame-ancestors).

### Secrets
- All secrets via environment variables; none in the repo. `.env.example` documents required
  keys without values.
- Rotate SMTP/storage/DB credentials if exposed; least-privilege DB user for the app.

## 2. Data integrity

- Relational constraints (FKs, uniques, checks) enforce invariants at the DB, not just the app.
- Multi-row operations run in **transactions**; partial writes are impossible
  ([01](01-architecture.md) §5.2).
- The **inventory ledger** and **audit log** are append-only; corrections are new rows
  ([06](06-inventory-ledger.md), [12](12-audit-trail.md)).
- A scheduled **reconciliation job** verifies `item_stock_balances` against the ledger and
  reports drift.
- Money as integer/decimal, never float ([07](07-finance-design.md)).

## 3. Reliability & recoverability

- **Database backups** are the single most important operational control:
  - Automated **daily** full backups + point-in-time recovery (WAL) where the host supports it.
  - Backups stored **off the primary host**; retention ≥ 30 days (firm to confirm).
  - **Test restores** periodically — an untested backup is not a backup.
- Object storage (files) versioned/backed up or on a durable provider.
- Email is best-effort with retries ([08](08-notifications.md)); failures never lose the source
  action (outbox pattern).
- Graceful error handling: user-facing errors are friendly; full detail goes to server logs.

## 4. File storage

- Uploads (photos, receipts, documents) go to **object storage**, not the database.
- Server-side **mime allowlist** (images, PDF, common docs) and **size cap** (e.g. 10–20 MB);
  reject the rest.
- Access via short-lived **signed URLs**, scoped to the requester's permissions.
- Store metadata (`files` table) for audit and cleanup; orphan-file cleanup job optional.
- Consider image downscaling/thumbnails for DSR photo galleries (performance + storage).

## 5. Performance

- Index FKs and filter columns ([02](02-data-model.md) §10); the ledger and expense tables are
  the hot paths.
- Paginate every list and report; stream large exports.
- Cache heavy dashboard/report aggregates with short TTL + manual refresh.
- Target: typical pages < 1s, report queries < 3s on realistic data (tens of projects, tens of
  thousands of ledger rows). This is a modest internal load; correctness > micro-optimization.
- Avoid N+1 queries (use ORM includes/joins).

## 6. Usability & accessibility

- Responsive: usable on a tablet/phone for field engineers submitting DSRs.
- Keyboard-accessible forms, proper labels, sufficient contrast (WCAG AA as a baseline).
- Designed **empty / loading / error** states everywhere (no bare "No data").
- Clear in-flight feedback on every mutation; disabled buttons while submitting (firm rule).
- Confirmations on destructive actions, styled as destructive.

## 7. Observability

- Structured server logs (request id, actor, action, latency, errors).
- Error tracking (e.g. Sentry) for unhandled exceptions.
- A lightweight **notification-health** and **reconciliation** admin view surfaces background-job
  problems.
- Audit trail provides the business-level "who did what" view.

## 8. Maintainability

- Layered architecture, module boundaries, single sources of truth (Zod schemas, money helper,
  permission keys, ref-code generator).
- Migrations versioned and forward-only in production; seed script for master data + first admin.
- Tests on the critical flows (ledger posting, approvals, budget vs actual, RBAC matrix).
- These docs kept current as the system evolves.

## 9. Compliance & data handling

- The system holds client, supplier, employee, and financial data — restrict access by role,
  log access to sensitive actions, and back up securely.
- Confirm with the firm: data residency (on-prem vs cloud), retention periods, and who may
  access financial reports.

## 10. Operational runbook (hand to whoever maintains it)

- How to: add a user, reset a password, run the reconciliation job, test SMTP, restore a backup,
  rotate secrets, read logs.
- Backup verification schedule and restore drill steps.
- Escalation contacts and the maintenance scope ([proposal §10](../README.md)).

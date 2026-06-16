# 12 — Audit Trail

## 1. Purpose

A trustworthy, immutable record of **who did what, when**. It is what makes the whole system
credible to management: every approval, release, adjustment, and submission is attributable.

The audit trail is distinct from the **inventory ledger** ([06](06-inventory-ledger.md)) and the
**notifications** log ([08](08-notifications.md)):

| Log | Answers | Append-only |
|-----|---------|:-----------:|
| `audit_logs` | Who performed which action on which record | yes |
| `stock_ledger` | How stock quantity changed | yes |
| `notifications` | What was sent to whom and its delivery status | yes (status updates allowed) |

They overlap by design (a stock release appears in all three) but serve different questions.

## 2. What gets logged (minimum)

Per the proposal §5.2, at least:

- Project create/update; status change; completion.
- Phase/task changes; delay flagged.
- Daily site report submitted / re-opened.
- Material request approved/rejected; release recorded; site receiving confirmed.
- Expense submitted/approved/rejected/paid.
- Budget set/revised/adjusted.
- Inventory adjustment, damage, waste, loss posting.
- Stock-in recorded.
- Notification send events.
- User created/deactivated; role/permission change.
- Settings changes (lookups, SMTP, notification settings).
- Authentication: repeated failed logins (security).

> Rule of thumb: **log every state change to a transactional record and every change to who-can-
> do-what.** Pure reads are not logged (except sensitive exports, optionally).

## 3. Schema (recap from [02](02-data-model.md) §2.3)

```
audit_logs(
  id, actor_id, action, entity_type, entity_id,
  summary, diff(jsonb), ip, user_agent, created_at
)
```

- `action` is a stable key (`expense.approved`, `material_request.rejected`).
- `entity_type` + `entity_id` point at the affected row.
- `summary` is a human line for the viewer ("Approved EXP-2026-00301 (₱12,500) for Project
  PRJ-2026-0007").
- `diff` captures changed fields `{ field: { from, to } }` for updates/state changes.
- `actor_id` null = system action (e.g. a scheduled delay flag).

## 4. Write strategy

- Audit writes happen **inside the same transaction** as the action they describe, so you can't
  have an approval without its log (or vice-versa).
- A small `audit(actorId, action, entity, summary, diff)` helper called from the service layer —
  not scattered through the code.
- Never expose create/update/delete of audit rows via API or UI. Optionally enforce at the DB
  level (revoke `UPDATE/DELETE`, or a trigger that blocks them).
- Capture request context (ip, user agent) where available; never store secrets or full payloads
  with sensitive data in `diff` (mask passwords, tokens).

## 5. Viewing

- **Global viewer** (admin): filter by actor, action, entity type, date range; paginated; newest
  first.
- **Per-entity history**: a "History" panel on detail pages (project, MR, expense, item) showing
  that record's audit rows — the most useful day-to-day view.
- **Employee activity report** ([09](09-reports-and-export.md)) is largely a curated view over
  `audit_logs` joined to DSR/receipt/approval activity.

## 6. Retention

- Keep audit logs for the full operational life of the system (they're small and high-value).
- If volume ever matters, archive older rows to cold storage rather than deleting; never delete
  for convenience.

## 7. Acceptance criteria

- Every action in §2 produces exactly one immutable audit row, written atomically with the
  action.
- The per-entity history panel shows a correct, ordered trail for any project, MR, expense, or
  item.
- Audit rows cannot be edited or deleted through any application path.

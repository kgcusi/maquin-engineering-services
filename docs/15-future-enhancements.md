# 15 — Future Enhancements & Extensibility

How to grow the system after v1 without painful rewrites, plus a prioritized backlog. The v1
design intentionally leaves room for each of these.

## 1. Extensibility built into v1

The architecture anticipates growth in specific places:

| Future need | Why v1 already supports it |
|-------------|----------------------------|
| **More roles** (Purchaser, Warehouse Keeper, Accountant) | Access is permission-keyed, not hard-coded to two roles ([03](03-roles-and-permissions.md)). Add a role + assign keys. |
| **Stock reservations** | Ledger + balances design supports `available = on_hand − reserved` without reshaping data ([06](06-inventory-ledger.md) §8). |
| **New report** | Add a query + export mapper + registry entry; the report shell handles the rest ([09](09-reports-and-export.md) §5). |
| **New notification** | Add an event key + template + settings row; dispatcher is data-driven ([08](08-notifications.md) §3). |
| **New movement type** | Add to the movement-type enum + a posting recipe; ledger structure unchanged. |
| **New lookup/category** | Admin-editable in Settings, no deploy ([04](04-modules.md) §5.3). |
| **Real job queue** | Notifications already use an outbox/dispatcher; swap the in-process bus for **Vercel Queues** (no worker to run) if volume grows. |
| **Multi-warehouse / multi-site** | Locations are first-class in the ledger from day one. |

> The two rules that protect future flexibility: keep business logic in the service/domain layer
> (not UI or SQL), and never bypass the ledger/audit append-only invariants.

## 2. Prioritized backlog (post-v1 candidates)

### Tier 1 — high value, natural next steps
- **Stock reservations** so approved-but-unreleased MRs reduce *available* stock and prevent
  over-promising.
- **In-app notification center** maturity (already modeled): preferences per user, read/unread,
  mute.
- **Purchase Orders & procurement:** PO → receive-against-PO → three-way match (PO/receipt/
  invoice). Stock-in currently records receipts directly; POs add the "what we ordered" side.
- **Mobile-optimized DSR capture** (PWA): offline draft + photo capture on site, sync when
  online — the highest-friction field workflow.
- **Document/photo thumbnails & galleries** with compression for fast site-photo browsing.

### Tier 2 — deeper management capability
- **Gantt / scheduling** with task dependencies and critical path (v1 tracks dates/status only).
- **Inventory valuation methods:** true FIFO/LIFO layers and cost-of-materials-used reporting
  (v1 supports weighted-average; [06](06-inventory-ledger.md) §9).
- **Progress billing / client invoicing** tied to phases and contract milestones, linking cash-IN
  to billings.
- **Subcontractor management:** subcontractor directory, contracts, and payment tracking as a
  first-class entity.
- **Budget forecasting / EAC** (estimate at completion) using burn rate.
- **Approval workflows:** multi-step / threshold-based approvals (e.g. expenses over X need two
  approvers), delegation, and SLA reminders.

### Tier 3 — integrations & scale
- **Accounting integration** (QuickBooks/Xero/local) to push approved expenses and cash flow.
- **Barcode / QR** for items and stock movements via phone camera.
- **Equipment management:** equipment as tracked assets with utilization, maintenance,
  depreciation (beyond the DSR free-text equipment list).
- **Client & supplier portals:** scoped external access to progress or order status.
- **Single sign-on (SSO)** if the firm adopts Google Workspace / Microsoft 365.
- **Analytics / BI:** a read replica or warehouse for cross-project trend analysis.
- **Multi-currency** for projects with foreign clients/suppliers.
- **Multi-company / branch** support if the firm operates multiple entities.

## 3. Technical debt to watch (and pay down deliberately)

- **Progress model:** decide derived-vs-manual early; retrofitting roll-up later is annoying.
- **Approvals unification:** unify in Stage 4 as planned — don't let per-module approval logic
  ossify.
- **Report performance:** as the ledger grows, introduce materialized views / read models for the
  heaviest reports before they get slow, not after.
- **Caching staleness:** keep cached aggregates explicitly invalidatable; document TTLs.
- **File lifecycle:** add orphan-file cleanup before storage costs/clutter grow.

## 4. Maintenance scope (from the proposal §10)

Ongoing support typically covers: bug fixes, minor adjustments, hosting/server + backup
monitoring, security updates, SMTP/email config support, and small usage-driven improvements.
**Major new features / modules** (most of this backlog) are separate development work — scope and
quote them individually, and update these docs when they land.

## 5. How to add a feature (the playbook)

1. Update the relevant doc(s) here first — design before code.
2. Migrate the schema additively (new tables/columns; avoid breaking changes —
   [database-migration discipline]).
3. Add business rules in the module's service/domain layer; keep invariants (ledger/audit/money)
   intact.
4. Expose via API with Zod validation + RBAC + scope.
5. Build UI to the project's design bar ([README](../README.md) conventions); design empty/
   loading/error states.
6. Wire events/notifications and audit logging.
7. Test the rules; verify in staging; demo to the firm.
8. Keep these docs current — they are the system's memory.

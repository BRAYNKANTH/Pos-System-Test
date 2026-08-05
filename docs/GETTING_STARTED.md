# Getting Started — Cloud POS System

Send this to the team. Steps 1–2 are one-time setup everyone does; then
jump to your own module section below.

## 1. One-time setup (everyone)

Install first if you don't have them: [Git](https://git-scm.com/downloads),
[Node.js 20+](https://nodejs.org), [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
git clone https://github.com/pwholdings-srilanka/Pos-System.git
cd Pos-System
npm install
```

Copy the environment file and fill it in:

```bash
cp .env.example .env.local
```

Open `.env.local` and ask the team lead for the real `DATABASE_URL` and
`DIRECT_URL` (Supabase) — paste them in. Leave the rest as-is unless your
module needs it (Zoho keys are only needed for the Sync module).

Start Redis (needed by the sync queue):

```bash
docker compose up -d
```

Run the app:

```bash
npm run dev
```

Open http://localhost:3000 — you should see the module list.

## 2. Create your own branch

Don't work directly on `main`. Pick one command below (replace `yourname`):

```bash
git checkout -b yourname/checkout-sales        # Person 1
git checkout -b yourname/bill-change-workflow  # Person 2
git checkout -b yourname/inventory-approval    # Person 3
git checkout -b yourname/sync-engine           # Person 4
git checkout -b yourname/customers-reports     # Person 5
```

When you've made progress and want to save it:

```bash
git add .
git commit -m "describe what you did"
git push -u origin yourname/your-branch-name
```

Then open a Pull Request on GitHub from your branch into `main` (or ask the
team lead to walk you through it the first time).

**Rule:** only touch files inside your own module's folders. If you need to
change something shared (`lib/auth/*`, `components/*`, or the `User`/
`AuditLog` tables in `prisma/schema.prisma`), post in the team chat first.

---

## Person 1 — Checkout / Sales

**Your folders:** `app/pos/`, `app/api/pos/`
**Read first:** `app/pos/OWNER.md`, then the "Checkout / Sales" section in
`docs/POS_Detailed_Build_Plan.md`

**Build order:** DB tables already exist in `prisma/schema.prisma`
(`Transaction`, `TransactionItem`, `TaxRule`) → backend functions → pages.

Backend functions to build (in `app/api/pos/`):
1. `lookupProduct` — `GET /api/pos/products?query=` — search by barcode/SKU/name
2. `calculateCart` — `POST /api/pos/cart/calculate` — subtotal/discount/tax per line
3. `applyDiscount` — `POST /api/pos/cart/discount`
4. `processPayment` — `POST /api/pos/checkout` — finalize sale, generate idempotency key
5. `generateReceipt` — `GET /api/pos/receipt/:id`

Pages to build (already have placeholder files in `app/pos/`):
- `/pos` — main POS screen (product grid + search)
- `/pos/payment` — cash/card/wallet split payment entry
- `/pos/receipt/[id]` — digital receipt

**First task:** start with `lookupProduct` — it's the simplest, and the
cart/checkout functions depend on it.

---

## Person 2 — Bill Change Workflow

**Your folders:** `app/bills/`, `app/admin/approvals/bills/`, `app/api/bills/`,
`app/api/auth/` (the `admin-reauth` route)
**Read first:** `app/bills/OWNER.md`, then the "Bill Change Workflow" section
in `docs/POS_Detailed_Build_Plan.md`

**Build order:** DB tables already exist (`Bill`, `BillChangeRequest`, plus
the shared `AuditLog`) → backend functions → pages.

Backend functions to build:
1. `lockBill` — internal trigger, fires right after Module 1's checkout completes
2. `submitChangeRequest` — `POST /api/bills/:id/request-change`
3. `authenticateAdmin` — `POST /api/auth/admin-reauth` — PIN/password re-auth
4. `approveChangeRequest` — `POST /api/bills/requests/:id/approve` — writes audit log + triggers Zoho re-sync
5. `rejectChangeRequest` — `POST /api/bills/requests/:id/reject`
6. `writeAuditLog` — internal helper, writes to the shared `audit_log` table (shape in `docs/api-contracts.md`)

Pages to build:
- `/bills/[id]` — locked bill detail (read-only)
- `/bills/[id]/request-change` — request form
- `/bills/requests` — my requests list
- `/admin/approvals/bills` — admin approval queue
- `/admin/approvals/bills/[id]` — approve/reject with PIN modal

**First task:** `writeAuditLog` first (everything else calls it), then
`submitChangeRequest`.

---

## Person 3 — Inventory & Approval

**Your folders:** `app/inventory/`, `app/admin/approvals/inventory/`,
`app/api/inventory/`
**Read first:** `app/inventory/OWNER.md`, then the "Inventory & Approval"
section in `docs/POS_Detailed_Build_Plan.md`

**Build order:** DB tables already exist (`InventoryItem`,
`StockAdjustment`, `ApprovalThreshold`) → backend functions → pages.

Backend functions to build:
1. `submitManualAdjustment` — `POST /api/inventory/:sku/adjust`
2. `checkThreshold` — internal helper, flags sudden/large adjustments
3. `holdForApproval` — internal, sets status to pending
4. `approveAdjustment` — `POST /api/inventory/adjustments/:id/approve` — writes audit log
5. `rejectAdjustment` — `POST /api/inventory/adjustments/:id/reject`
6. `getLowStockAlerts` — `GET /api/inventory/low-stock`
7. `deductStockOnSale` / `increaseStockOnReceipt` / `lockStockRow` — race-condition-safe stock changes

Pages to build:
- `/inventory` — stock list / dashboard
- `/inventory/[sku]` — item detail + history
- `/inventory/[sku]/adjust` — manual adjustment form
- `/admin/approvals/inventory` — admin approval queue
- `/admin/approvals/inventory/[id]` — approval detail

**First task:** `submitManualAdjustment` + `checkThreshold` — the core of
the approval workflow.

---

## Person 4 — Sync Engine & Integration

**Your folders:** `lib/sync/`, `app/api/sync/`, `app/admin/settings/integrations/`,
`app/admin/sync-status/`
**Read first:** `lib/sync/OWNER.md`, then the "Sync Engine & Integration"
section in `docs/POS_Detailed_Build_Plan.md`

**Build order:** DB tables already exist (`SyncQueueJob`, `ZohoConnection`)
→ queue/worker logic → OAuth flow → status pages.

Backend functions to build:
1. `connectZohoOAuth` — `GET /api/sync/oauth/connect`
2. `enqueueSyncJob` — the function every other module calls (shape in `docs/api-contracts.md`)
3. `processSyncQueue` — BullMQ worker, ~100 calls/min limit
4. `retryWithBackoff` — exponential backoff on HTTP 429
5. `refreshZohoToken`, `mapBranchToOrg`, `applyIdempotencyKey`
6. `queueOfflineTransaction` / `syncOnReconnect` — offline-first support

Pages to build:
- `/admin/settings/integrations` — Zoho OAuth connect button
- `/admin/sync-status` — queued/failed/synced job status

**First task:** `enqueueSyncJob` first — Modules 1–3 are waiting to call it
(they should mock it against `docs/api-contracts.md` until it's real, so
don't feel rushed, but it unblocks everyone once it exists). The BullMQ
connection helper is already stubbed in `lib/queue/connection.ts`.

---

## Person 5 — Customers, Reports & Admin Settings

**Your folders:** `app/customers/`, `app/orders/`, `app/reports/`,
`app/admin/settings/roles/`, `app/admin/settings/thresholds/`,
`app/api/customers/`, `app/api/orders/`, `app/api/reports/`, `app/api/admin/`,
plus `lib/auth/rbac.ts` (shared — you own the real implementation)
**Read first:** `app/customers/OWNER.md`, then the "Customers, Reports &
Admin Settings" section in `docs/POS_Detailed_Build_Plan.md`

**Build order:** DB tables already exist (`Customer`, `Order`,
`RolePermission`) → backend functions → pages.

Backend functions to build:
1. `checkPermission` — replace the static stub in `lib/auth/rbac.ts` with a
   real lookup against the `RolePermission` table
2. `createOrUpdateCustomer` — `POST /api/customers`
3. `getCustomerHistory` — `GET /api/customers/:id`
4. `updateOrderStatus` — `PATCH /api/orders/:id`
5. `generateZReport` — `GET /api/reports/z-report?date=`
6. `getSalesTrends` — `GET /api/reports/sales-trends`
7. `getAuditReport` — `GET /api/reports/audit?filters=` — reads the shared `audit_log` table
8. `updateApprovalThresholds` — `PATCH /api/admin/thresholds`
9. `manageRoles` — `POST/PATCH /api/admin/roles`

Pages to build:
- `/customers`, `/customers/[id]`
- `/orders`
- `/reports/daily`, `/reports/sales`, `/reports/audit`
- `/admin/settings/roles`, `/admin/settings/thresholds`

**First task:** `checkPermission` — every other module's protected routes
are already calling the stub version, so making it real (backed by the DB)
unblocks everyone's approval flows.

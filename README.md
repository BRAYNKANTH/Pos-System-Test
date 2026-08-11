# Cloud POS System

A cloud-integrated Point of Sale system for retail/service businesses, with
two-way sync to Zoho Books and both online (cloud-synced) and offline
(local-first) operation. Two core differentiators:

1. Administrator-controlled approval for any change to an already-recorded
   bill/invoice.
2. Administrator-controlled approval for sudden/large inventory
   adjustments.

Full scope, per-module pages/backend functions/DB tables:
[docs/POS_Detailed_Build_Plan.md](./docs/POS_Detailed_Build_Plan.md).
Shared shapes (API envelope, audit log, sync job, RBAC):
[docs/api-contracts.md](./docs/api-contracts.md).

## Tech stack

- **Frontend**: Next.js (App Router), React, Tailwind CSS
- **Backend**: Next.js Route Handlers
- **Database**: PostgreSQL on Supabase via Prisma
- **Auth**: custom email/password sessions (bcrypt + signed JWT cookie),
  see `lib/auth/session.ts`
- **Local client storage (offline mode)**: IndexedDB (Dexie.js)
- **Sync queue**: the `sync_queue` DB table + a standalone polling worker
  (no Redis/BullMQ, no extra service to install — see `lib/sync/`)
- **State**: Zustand / TanStack Query

## Getting started

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local`:
- `DATABASE_URL` / `DIRECT_URL` — your Supabase project's connection
  strings (pooled + direct — see comments in `.env.example` for the
  pgbouncer/percent-encoding gotchas).
- `SESSION_SECRET` — any long random string for local dev.
- `ZOHO_CLIENT_ID` / `ZOHO_CLIENT_SECRET` — only needed to actually reach
  Zoho; everything else works without them (sync jobs just sit as
  `failed` on `/admin/sync-status`).

Apply the schema and seed some starter data (an admin + cashier login,
a handful of products, default thresholds/permissions):

```bash
npm run prisma:migrate
npm run db:seed
```

Run the dev server:

```bash
npm run dev
```

Seeded logins: `admin@pos.local` / `Admin123!` and `cashier@pos.local` /
`Cashier123!`.

To process the Zoho sync queue, run the worker in a separate terminal:

```bash
npm run worker
```

## Repo structure

```
app/pos/*                    → Checkout / Sales
app/bills/*                  → Bill Change Workflow
app/inventory/*              → Inventory & Approval
app/customers/*, app/orders/*, app/reports/*
                              → Customers, Reports & Admin Settings
app/admin/*                  → admin route tree — approvals, settings, sync status

app/api/*                    → API routes, mirrors the structure above
lib/sync/*                   → Zoho OAuth, sync queue, worker, retry/backoff
lib/inventory/stock.ts       → race-safe stock deduction, threshold/approval logic
lib/bills/changeRequests.ts  → bill change request submit/approve/reject
lib/audit/writeAuditLog.ts   → shared append-only audit log helper
lib/auth/*                   → session management + RBAC
lib/offline/*                → Dexie offline queue + reconnect sync
lib/prisma.ts                → Prisma client singleton
lib/api-response.ts          → shared API response envelope helper
components/ui/*              → shared UI primitives (button, badge, modal)
components/ApprovalActions.tsx → shared approve/reject-with-reauth pattern

prisma/schema.prisma         → full DB schema
prisma/seed.ts                → starter data
scripts/worker.ts            → standalone sync worker entrypoint (`npm run worker`)
docs/                        → build plan, API contracts
```

## Conventions

- Every route handler returns the shared envelope from
  `lib/api-response.ts` (`apiSuccess` / `apiError`) — see
  `docs/api-contracts.md`.
- Protected routes call `checkPermission()` from `lib/auth/rbac.ts`
  (DB-backed via the `roles_permissions` table, editable at
  `/admin/settings/roles`).
- Approval actions (bill changes, inventory adjustments) require a
  password re-auth (`/api/auth/admin-reauth`) before the approve/reject
  call succeeds — see `components/ApprovalActions.tsx`.
- Anything that needs to reach Zoho goes through `enqueueSyncJob`
  (`lib/sync/enqueueSyncJob.ts`), never a direct API call — see
  `docs/api-contracts.md` for the job payload shape.
- The original transaction/bill is never mutated by an approved change —
  see the comments in `lib/bills/changeRequests.ts`.

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
Module ownership: [docs/task-allocation-plan.md](./docs/task-allocation-plan.md).
Shared shapes (API envelope, audit log, sync job, RBAC):
[docs/api-contracts.md](./docs/api-contracts.md).

## Tech stack

- **Frontend**: Next.js (App Router), React, Tailwind CSS
- **Backend**: Next.js Route Handlers / Server Actions
- **Database**: PostgreSQL on Supabase (shared team project) via Prisma
- **Local client storage (offline mode)**: IndexedDB (Dexie.js)
- **Job queue**: Redis + BullMQ (background sync to Zoho)
- **State**: Zustand / TanStack Query
- **Containers**: Docker Compose (Redis only — Postgres is on Supabase)

## Getting started

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local`:
- `DATABASE_URL` / `DIRECT_URL` — ask whoever holds the shared Supabase
  project for these. Don't create your own project; everyone reads/writes
  the same instance.
- `REDIS_URL` — leave as `redis://localhost:6379` if you run Redis locally
  via Docker Compose below.
- `ZOHO_CLIENT_ID` / `ZOHO_CLIENT_SECRET` — only needed if you're working
  on Module 4 (Sync Engine).

Start Redis (needed for BullMQ / Module 4, and anywhere else that enqueues
sync jobs):

```bash
docker compose up -d
```

Apply the schema to your Supabase instance once `DATABASE_URL`/`DIRECT_URL`
are real:

```bash
npm run prisma:migrate
```

Run the dev server:

```bash
npm run dev
```

## Repo structure

```
app/pos/*                    → Module 1: Checkout / Sales
app/bills/*                  → Module 2: Bill Change Workflow
app/inventory/*              → Module 3: Inventory & Approval
app/customers/*, app/orders/*, app/reports/*
                              → Module 5: Customers, Reports & Admin Settings
app/admin/*                  → SHARED route tree — see task-allocation-plan.md
                                for the per-subfolder ownership split

app/api/*                    → API routes, mirrors the module split above
lib/sync/*                   → Module 4: Sync Engine & Integration
lib/auth/*                   → shared RBAC — flag before editing
lib/prisma.ts                → shared Prisma client singleton
lib/api-response.ts          → shared API response envelope helper
lib/queue/connection.ts      → shared Redis connection for BullMQ
components/ui/*              → shared UI primitives (button, badge, modal)

prisma/schema.prisma         → full DB schema, all modules' tables
docs/                        → build plan, task allocation, API contracts
```

Each module folder has an `OWNER.md` — read it before editing. Don't edit
outside your module's folders without flagging it with the owner first.
Files marked **shared** (`lib/auth/*`, `components/*`, the core tables in
`prisma/schema.prisma`) need the same courtesy — your own module's models
and pages are always fine to edit freely.

## Conventions

- Every route handler returns the shared envelope from
  `lib/api-response.ts` (`apiSuccess` / `apiError`) — see
  `docs/api-contracts.md`.
- Protected routes call `checkPermission()` from `lib/auth/rbac.ts`.
- Anything that needs to reach Zoho goes through Module 4's
  `enqueueSyncJob`, never a direct API call — see `docs/api-contracts.md`
  for the job payload shape.
- If you're blocked on another module's real implementation, mock it
  against the contract in `docs/api-contracts.md` rather than waiting.

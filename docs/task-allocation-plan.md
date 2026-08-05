# Task Allocation Plan

Module-based, full-stack ownership. All 5 people work in parallel from Day
1, building against the shared contracts in
[api-contracts.md](./api-contracts.md).

| # | Module | Owner | Scope |
|---|---|---|---|
| 1 | Checkout / Sales | Person 1 | Product lookup, cart, discounts, tax, split payments, receipt, idempotency keys |
| 2 | Bill Change Workflow | Person 2 | Locked bills, change-request + admin approval flow, immutable audit log, linked Zoho credit-note sync |
| 3 | Inventory & Approval | Person 3 | Automated + manual stock updates, threshold detection, pending-approval state, race-condition-safe concurrent updates |
| 4 | Sync Engine & Integration | Person 4 | Zoho OAuth 2.0, BullMQ queue, retry/backoff on rate limits, idempotency, offline-first sync-on-reconnect |
| 5 | Customers, Reports & Admin Settings | Person 5 | Customer profiles, order tracking, X/Z-Report, audit report, RBAC, approval threshold settings |

## Folder ownership map

Every module folder has an `OWNER.md` — read it before editing. Don't edit
another module's folder without flagging it with that owner first (PR
comment, Slack, whatever the team uses).

```
app/pos/*                            → Person 1
app/bills/*                          → Person 2
app/inventory/*                      → Person 3
app/customers/*, app/orders/*,
app/reports/*                        → Person 5

app/admin/*  — SHARED route tree, split at the subfolder level:
  app/admin/approvals/bills/         → Person 2
  app/admin/approvals/inventory/     → Person 3
  app/admin/settings/integrations/   → Person 4
  app/admin/sync-status/             → Person 4
  app/admin/settings/roles/          → Person 5
  app/admin/settings/thresholds/     → Person 5

app/api/pos/*, app/api/bills/*, app/api/inventory/*,
app/api/sync/*, app/api/customers/*, app/api/orders/*,
app/api/reports/*, app/api/admin/*   → mirrors the frontend split above
app/api/auth/*                       → Person 2 owns admin-reauth today;
                                        shared namespace, flag before adding

lib/sync/*                           → Person 4
lib/auth/*                           → shared — flag before editing
components/*                         → shared — flag before editing
prisma/schema.prisma (core tables:
  User, AuditLog)                    → shared — flag before editing;
                                        your own module's models are fine
                                        to edit freely
```

> Note: this is more granular than "one module = one top-level folder" for
> `app/admin/*` and `app/api/auth/*` — the detailed build plan
> (`docs/POS_Detailed_Build_Plan.md`) puts pages from Modules 2, 3, 4 and 5
> all under `/admin/*`, so ownership is tracked per subfolder instead.

## Shared Supabase project

Everyone points at the same Postgres instance via `DATABASE_URL` /
`DIRECT_URL` in `.env.local` (never committed — copy from `.env.example`
and get the real values from whoever holds the Supabase project). Run
`npm run prisma:migrate` after pulling schema changes from `main`.

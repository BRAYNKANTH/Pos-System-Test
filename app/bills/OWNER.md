# Owner: Person 2 — Bill Change Workflow

Owns: locked bills, change-request + admin approval flow, immutable audit log, linked Zoho credit-note sync.

Pages:
- `/bills/[id]` — locked bill detail (read-only)
- `/bills/[id]/request-change` — request correction/refund/void
- `/bills/requests` — cashier/manager's own request list

The approval side of this workflow lives in `app/admin/approvals/bills/` (same owner).
Backend: `app/api/bills/*`, `app/api/auth/admin-reauth` (re-auth before any bill mutation).
Writes to the shared `audit_log` table — see docs/api-contracts.md for the entry shape.

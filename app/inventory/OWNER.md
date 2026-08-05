# Owner: Person 3 — Inventory & Approval

Owns: automated + manual stock updates, threshold detection, pending-approval state, race-condition-safe concurrent updates.

Pages:
- `/inventory` — stock list / dashboard
- `/inventory/[sku]` — item detail + change history
- `/inventory/[sku]/adjust` — manual adjustment form
- `/inventory/locations` — multi-location view (Should-priority)

The approval side lives in `app/admin/approvals/inventory/` (same owner).
Backend: `app/api/inventory/*`.
Writes to the shared `audit_log` table — see docs/api-contracts.md for the entry shape.

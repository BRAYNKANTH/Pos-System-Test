# Owner: Shared route tree — no single owner

`app/admin/*` is split across three module owners. Do not add files directly
under `app/admin/` itself (no index page is specified) — only in the
subfolders below:

- `app/admin/approvals/bills/`        → Person 2 (Bill Change Workflow)
- `app/admin/approvals/inventory/`    → Person 3 (Inventory & Approval)
- `app/admin/settings/integrations/`  → Person 4 (Sync Engine & Integration)
- `app/admin/sync-status/`            → Person 4 (Sync Engine & Integration)
- `app/admin/settings/roles/`         → Person 5 (Admin Settings)
- `app/admin/settings/thresholds/`    → Person 5 (Admin Settings)

This mirrors docs/POS_Detailed_Build_Plan.md exactly — note it's more granular
than "app/admin/* = Module 5" from the original repo sketch; the detailed
build plan is the source of truth.

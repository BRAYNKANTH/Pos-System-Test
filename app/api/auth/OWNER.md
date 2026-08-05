# Owner: Person 2 — Bill Change Workflow (shared namespace — flag before adding routes)

Endpoint: `POST /api/auth/admin-reauth` — PIN/password re-auth required before
any bill mutation. This sits under the general `/api/auth/` namespace, which
other modules may also need (e.g. login/session) — flag in PR review before
adding anything else here so we don't collide.

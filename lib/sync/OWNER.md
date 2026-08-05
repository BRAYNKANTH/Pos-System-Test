# Owner: Person 4 — Sync Engine & Integration

Owns: Zoho OAuth 2.0, BullMQ queue, retry/backoff on rate limits,
idempotency, offline-first sync-on-reconnect.

Other modules call into this via `enqueueSyncJob` (contract in
docs/api-contracts.md → SyncJobPayload) — don't reach into Zoho directly.

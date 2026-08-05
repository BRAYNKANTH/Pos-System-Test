# Owner: Person 1 — Checkout / Sales

Owns: product lookup, cart, discounts, tax, split payments, receipt, idempotency keys.

Pages (per docs/POS_Detailed_Build_Plan.md):
- `/pos` — main POS screen (product grid + search)
- `/pos/payment` — cash/card/wallet split payment entry
- `/pos/receipt/[id]` — digital receipt + print trigger

Backend: `app/api/pos/*`.

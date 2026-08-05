# Cloud POS System — Detailed Build Plan

Pages, backend functions, and database tables per module. Transcribed from
`POS_Detailed_Build_Plan.pdf` so it lives in-repo (not just as a binary).

Build order within a module: **DB tables → backend functions → pages that
call them.**

---

## 1. Checkout / Sales — Person 1

### Database Tables
- `transactions` — id, register_id, cashier_id, subtotal, tax, total, payment_method, status, idempotency_key, created_at
- `transaction_items` — id, transaction_id, sku, qty, unit_price, discount, tax_amount
- `tax_rules` — id, region, category, rate

### Backend Functions
| Function | Endpoint | Purpose |
|---|---|---|
| `lookupProduct` | `GET /api/pos/products?query=` | Search by barcode/SKU/name for the product menu |
| `calculateCart` | `POST /api/pos/cart/calculate` | Compute subtotal, discounts, tax per line item |
| `applyDiscount` | `POST /api/pos/cart/discount` | Apply promo/discount code or manual discount |
| `processPayment` | `POST /api/pos/checkout` | Finalize sale — cash/card/wallet, generates idempotency key |
| `generateReceipt` | `GET /api/pos/receipt/:id` | Return receipt data for print/digital view |
| `calculateTax` | internal helper | Applies tax_rules by item/region during checkout |

### Frontend Pages
| Page | Route | What It Does |
|---|---|---|
| Checkout / Main POS screen | `/pos` | Product grid + barcode/SKU search bar |
| Product search panel | (component on `/pos`) | Live search-as-you-type results |
| Cart & discounts panel | (side panel on `/pos`) | Line items, apply discount, remove item |
| Payment screen | `/pos/payment` | Cash/card/wallet split payment entry |
| Receipt view | `/pos/receipt/[id]` | Digital receipt + print trigger |
| Offline indicator | (global banner) | Shows when running in local-only mode |

---

## 2. Bill Change Workflow — Person 2

### Database Tables
- `bills` — id, transaction_id, status (locked/editable), locked_at
- `bill_change_requests` — id, bill_id, requested_by, type (correction/refund/void), reason, proposed_changes, status, approved_by, approved_at
- `audit_log` — id, entity_type, entity_id, old_value, new_value, actor_id, approver_id, reason, timestamp

### Backend Functions
| Function | Endpoint | Purpose |
|---|---|---|
| `lockBill` | internal trigger on checkout | Locks bill immediately after transaction completes |
| `submitChangeRequest` | `POST /api/bills/:id/request-change` | Cashier/Manager submits correction/refund/void request |
| `authenticateAdmin` | `POST /api/auth/admin-reauth` | PIN/password re-auth before any bill mutation |
| `approveChangeRequest` | `POST /api/bills/requests/:id/approve` | Admin approves — triggers audit log + Zoho re-sync |
| `rejectChangeRequest` | `POST /api/bills/requests/:id/reject` | Admin rejects with logged reason |
| `writeAuditLog` | internal helper | Writes immutable entry: old/new values, actor, approver, timestamp, reason |
| `syncBillAdjustment` | internal, calls Module 4 queue | Sends linked credit note/updated invoice to Zoho, never overwrites original |
| `notifyAdmin` | internal, in-app/email | Notifies Admin when a request is pending |

### Frontend Pages
| Page | Route | What It Does |
|---|---|---|
| Bill detail (locked) view | `/bills/[id]` | Read-only, shows locked status |
| Request change form | `/bills/[id]/request-change` | Reason, proposed correction, item selector |
| My requests list | `/bills/requests` | Cashier/Manager view — status: pending/approved/rejected |
| Admin approval queue | `/admin/approvals/bills` | List of pending bill-change requests |
| Approval detail + PIN modal | `/admin/approvals/bills/[id]` | Approve/reject with elevated re-auth |

---

## 3. Inventory & Approval — Person 3

### Database Tables
- `inventory_items` — id, sku, name, qty_on_hand, location_id, low_stock_threshold
- `stock_adjustments` — id, sku, qty_change, type (automated/manual), reason_category, status (applied/pending), threshold_flagged, requested_by, approved_by, created_at
- `approval_thresholds` — id, category/sku scope, threshold_type (percent/absolute), value

### Backend Functions
| Function | Endpoint | Purpose |
|---|---|---|
| `deductStockOnSale` | internal trigger from Module 1 | Automated deduction in real time as items sell |
| `increaseStockOnReceipt` | `POST /api/inventory/goods-receipt` | Automated increase from purchase orders |
| `submitManualAdjustment` | `POST /api/inventory/:sku/adjust` | Staff submits stock take/damage/spoilage/correction |
| `checkThreshold` | internal helper | Flags adjustment as sudden/large per configured threshold |
| `holdForApproval` | internal, sets status=pending | Holds over-threshold adjustment until admin review |
| `approveAdjustment` | `POST /api/inventory/adjustments/:id/approve` | Admin approves — applies change, writes audit log |
| `rejectAdjustment` | `POST /api/inventory/adjustments/:id/reject` | Admin rejects with logged reason |
| `lockStockRow` | internal, row-level lock | Prevents race conditions across concurrent terminal sales |
| `getLowStockAlerts` | `GET /api/inventory/low-stock` | Returns items below threshold, PO suggestions |

### Frontend Pages
| Page | Route | What It Does |
|---|---|---|
| Stock list / dashboard | `/inventory` | Real-time levels, low-stock highlights |
| Item detail + history | `/inventory/[sku]` | Automated + manual change history |
| Manual adjustment form | `/inventory/[sku]/adjust` | Qty, reason/category dropdown |
| Admin inventory approval queue | `/admin/approvals/inventory` | List of pending large adjustments |
| Approval detail view | `/admin/approvals/inventory/[id]` | Stock history, reason, evidence, approve/reject |
| Multi-location stock view | `/inventory/locations` | Should-priority, build after Musts |

---

## 4. Sync Engine & Integration — Person 4

### Database Tables
- `sync_queue` — id, entity_type, entity_id, payload, status (pending/synced/failed), retry_count, last_attempt_at
- `zoho_connections` — id, branch_id, organization_id, data_center, access_token, refresh_token, expires_at

### Backend Functions
| Function | Endpoint | Purpose |
|---|---|---|
| `connectZohoOAuth` | `GET /api/sync/oauth/connect` | Starts OAuth 2.0 flow for a branch |
| `refreshZohoToken` | internal, scheduled | Auto-refreshes access token before expiry |
| `mapBranchToOrg` | internal helper | Maps POS branch/register to Zoho organization_id + data center |
| `enqueueSyncJob` | internal, called by Modules 1-3 | Adds a transaction/bill/inventory change to BullMQ queue |
| `processSyncQueue` | background worker | Sends queued jobs to Zoho, respecting ~100 calls/min limit |
| `retryWithBackoff` | internal helper | Exponential backoff retry on HTTP 429 |
| `applyIdempotencyKey` | internal helper | Prevents duplicate records on retry |
| `queueOfflineTransaction` | internal, local storage | Stores transactions locally when offline |
| `syncOnReconnect` | internal trigger | Flushes offline queue in original order once connectivity returns |

### Frontend / Admin Pages
| Page | Route | What It Does |
|---|---|---|
| Zoho connection settings | `/admin/settings/integrations` | OAuth connect button, org/branch mapping |
| Sync status view | `/admin/sync-status` | Shows queued/failed/synced jobs (optional but useful for debugging) |

---

## 5. Customers, Reports & Admin Settings — Person 5

### Database Tables
- `customers` — id, name, email, phone, loyalty_metadata, created_at
- `orders` — id, customer_id, status (pending/preparing/fulfilled/refunded)
- `roles_permissions` — id, role, permission_key, threshold_value

### Backend Functions
| Function | Endpoint | Purpose |
|---|---|---|
| `createOrUpdateCustomer` | `POST /api/customers` | Create/update profile, syncs to Zoho contacts |
| `getCustomerHistory` | `GET /api/customers/:id` | Purchase history lookup |
| `updateOrderStatus` | `PATCH /api/orders/:id` | Pending/preparing/fulfilled/refunded tracking |
| `generateZReport` | `GET /api/reports/z-report?date=` | Daily cash register reconciliation |
| `getSalesTrends` | `GET /api/reports/sales-trends` | Top items, profit margin, trend data |
| `getAuditReport` | `GET /api/reports/audit?filters=` | Pulls from audit_log (Modules 2 & 3), filterable |
| `checkPermission` | internal middleware | RBAC check used across all modules' protected routes |
| `updateApprovalThresholds` | `PATCH /api/admin/thresholds` | Admin configures inventory/bill thresholds |
| `manageRoles` | `POST/PATCH /api/admin/roles` | Admin assigns roles/permissions per user |

### Frontend Pages
| Page | Route | What It Does |
|---|---|---|
| Customer list | `/customers` | Search/filter |
| Customer profile | `/customers/[id]` | Contact info, purchase history |
| Order status tracker | `/orders` | Restaurant/service use, Could-priority |
| Daily reconciliation report | `/reports/daily` | X/Z-Report |
| Sales trend report | `/reports/sales` | Charts: top items, profit margin |
| Audit report | `/reports/audit` | Filterable by date/user/status |
| Role & permission settings | `/admin/settings/roles` | Configure who can do what |
| Approval threshold settings | `/admin/settings/thresholds` | Set inventory/bill approval thresholds |

---

## Shared Contracts

Core DB schema (transactions, inventory_items, bills, audit_log, users),
audit_log entry shape (Modules 2, 3, 5), API contract format published by
Module 4 first, shared UI components (approval-queue pattern, badges,
modals used by Modules 2 and 3), and file/folder ownership boundaries to
avoid merge conflicts.

See [api-contracts.md](./api-contracts.md) for the concrete shapes and
[task-allocation-plan.md](./task-allocation-plan.md) for the folder-level
ownership map (including the `app/admin/*` split, which is more granular
than a simple "one module = one top-level folder" rule).

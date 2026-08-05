# API Contracts

Shared shapes every module builds against. Implementations live in `lib/`
— this doc is the spec; the code is the source of truth if they ever
drift, but please keep them in sync.

## API response envelope

Implementation: [`lib/api-response.ts`](../lib/api-response.ts) —
`apiSuccess()` / `apiError()`. Every route handler in every module returns
one of these two shapes.

```ts
type ApiSuccess<T> = {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
};

type ApiError = {
  success: false;
  error: {
    code: string;      // machine-readable, e.g. "BILL_LOCKED", "THRESHOLD_EXCEEDED"
    message: string;   // human-readable
    details?: unknown;
  };
  meta?: Record<string, unknown>;
};
```

Usage in a route handler:

```ts
import { apiSuccess, apiError } from "@/lib/api-response";

export async function POST(req: Request) {
  const item = await lookUp();
  if (!item) return apiError("NOT_FOUND", "Item not found", { status: 404 });
  return apiSuccess(item);
}
```

## Audit log entry

Implementation: `AuditLog` model in
[`prisma/schema.prisma`](../prisma/schema.prisma), table `audit_log`.
Written by Modules 2 and 3 on every approved bill change / stock
adjustment; read by Module 5's `/reports/audit`. **Append-only — never
update or delete a row.**

```ts
type AuditLogEntry = {
  id: string;
  entityType: string;   // "bill" | "bill_change_request" | "stock_adjustment" | ...
  entityId: string;
  oldValue: unknown | null;  // JSON snapshot before the change
  newValue: unknown | null;  // JSON snapshot after the change
  actorId: string;      // who requested/performed the change
  approverId: string | null; // who approved it (admin), null if not yet approved
  reason: string | null;
  timestamp: string;    // ISO 8601
};
```

## Sync job payload

Implementation: `SyncQueueJob` model in
[`prisma/schema.prisma`](../prisma/schema.prisma), table `sync_queue`, and
the BullMQ job data enqueued via Module 4's `enqueueSyncJob` (in
`lib/sync/`). Modules 1–3 call `enqueueSyncJob` — never talk to Zoho
directly.

```ts
type SyncJobPayload = {
  id: string;
  entityType: "transaction" | "bill" | "stock_adjustment" | "customer";
  entityId: string;
  payload: unknown;         // entity-shaped data to send to Zoho
  status: "pending" | "synced" | "failed";
  retryCount: number;
  lastAttemptAt: string | null; // ISO 8601
  idempotencyKey?: string;      // required for anything that creates a Zoho record
};
```

## RBAC — roles & permission keys

Implementation: [`lib/auth/rbac.ts`](../lib/auth/rbac.ts) —
`checkPermission(role, permission)`. The current version is a static map;
Person 5 will back it with the `roles_permissions` table
(`RolePermission` model) so thresholds/permissions are admin-configurable
at `/admin/settings/roles`.

```ts
type Role = "ADMIN" | "MANAGER" | "CASHIER"; // Prisma enum, see schema.prisma

const PERMISSIONS = {
  BILLS_APPROVE: "bills:approve",
  BILLS_REJECT: "bills:reject",
  BILLS_REQUEST_CHANGE: "bills:request-change",
  INVENTORY_APPROVE: "inventory:approve",
  INVENTORY_REJECT: "inventory:reject",
  INVENTORY_ADJUST: "inventory:adjust",
  ADMIN_MANAGE_THRESHOLDS: "admin:manage-thresholds",
  ADMIN_MANAGE_ROLES: "admin:manage-roles",
  ADMIN_REAUTH: "admin:reauth",
  REPORTS_VIEW: "reports:view",
  REPORTS_AUDIT_VIEW: "reports:audit-view",
} as const;
```

Usage in a route handler:

```ts
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";

if (!checkPermission(currentUser.role, PERMISSIONS.BILLS_APPROVE)) {
  return apiError("FORBIDDEN", "Not allowed", { status: 403 });
}
```

Adding a new permission key: add it to `PERMISSIONS` in `lib/auth/rbac.ts`
(shared file — flag the change) rather than inventing a string inline.

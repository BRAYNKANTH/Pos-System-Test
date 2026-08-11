# API Contracts

Shared shapes used throughout the codebase. Implementations live in
`lib/` — this doc is the spec; the code is the source of truth if they
ever drift.

## API response envelope

Implementation: [`lib/api-response.ts`](../lib/api-response.ts) —
`apiSuccess()` / `apiError()`. Every route handler returns one of these
two shapes.

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
Written on every approved bill change / stock adjustment (see
`lib/bills/changeRequests.ts`, `lib/inventory/stock.ts`,
`lib/audit/writeAuditLog.ts`); read by `/reports/audit`.
**Append-only — never update or delete a row.**

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
[`prisma/schema.prisma`](../prisma/schema.prisma), table `sync_queue`.
Anything that needs to reach Zoho calls `enqueueSyncJob`
(`lib/sync/enqueueSyncJob.ts`) rather than talking to Zoho directly. A
standalone worker (`npm run worker`, see `lib/sync/worker.ts`) polls this
table and processes pending rows.

```ts
type SyncJobPayload = {
  id: string;
  entityType: "transaction" | "bill" | "stock_adjustment" | "customer";
  entityId: string;
  payload: unknown;         // entity-shaped data to send to Zoho
  status: "pending" | "synced" | "failed";
  retryCount: number;
  lastAttemptAt: string | null; // ISO 8601
};
```

## RBAC — roles & permission keys

Implementation: [`lib/auth/rbac.ts`](../lib/auth/rbac.ts) —
`checkPermission(role, permission)`. DB-backed via the
`roles_permissions` table (`RolePermission` model), editable live at
`/admin/settings/roles`; falls back to a static default map only for a
role with zero rows configured (e.g. right after a fresh migration,
before `prisma/seed.ts` has run).

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

if (!(await checkPermission(currentUser.role, PERMISSIONS.BILLS_APPROVE))) {
  return apiError("FORBIDDEN", "Not allowed", { status: 403 });
}
```

Adding a new permission key: add it to `PERMISSIONS` in `lib/auth/rbac.ts`
rather than inventing a string inline.

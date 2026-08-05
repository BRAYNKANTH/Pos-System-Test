import type { Role } from "@prisma/client";

export type { Role };

// Permission keys used across modules' protected routes. Add new keys here
// (don't invent ad-hoc strings in route handlers) and flag the change —
// this file is shared.
export const PERMISSIONS = {
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

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// TODO(Person 5): replace this static map with a lookup against the
// `roles_permissions` table (see prisma/schema.prisma → RolePermission) so
// admins can configure permissions/thresholds at runtime via
// /admin/settings/roles. This stub exists so every module can build against
// a stable `checkPermission` signature from day one.
const DEFAULT_GRANTS: Record<Role, PermissionKey[]> = {
  ADMIN: Object.values(PERMISSIONS),
  MANAGER: [
    PERMISSIONS.BILLS_REQUEST_CHANGE,
    PERMISSIONS.INVENTORY_ADJUST,
    PERMISSIONS.REPORTS_VIEW,
  ],
  CASHIER: [PERMISSIONS.BILLS_REQUEST_CHANGE, PERMISSIONS.INVENTORY_ADJUST],
};

export function checkPermission(role: Role, permission: PermissionKey): boolean {
  return DEFAULT_GRANTS[role]?.includes(permission) ?? false;
}

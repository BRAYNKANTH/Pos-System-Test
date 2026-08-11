import { cache } from "react";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type { Role };

// Permission keys used across modules' protected routes. Add new keys here
// (don't invent ad-hoc strings in route handlers) rather than inventing
// ad-hoc strings inline.
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
  // User Management
  USER_VIEW: "user:view",
  USER_CREATE: "user:create",
  USER_UPDATE: "user:update",
  USER_DELETE: "user:delete",
  // Roles Management
  ROLE_VIEW: "role:view",
  ROLE_CREATE: "role:create",
  ROLE_UPDATE: "role:update",
  ROLE_DELETE: "role:delete",
  // Suppliers
  SUPPLIER_VIEW: "supplier:view",
  SUPPLIER_VIEW_OWN: "supplier:view-own",
  SUPPLIER_CREATE: "supplier:create",
  SUPPLIER_UPDATE: "supplier:update",
  SUPPLIER_DELETE: "supplier:delete",
  // Customers
  CUSTOMER_VIEW: "customer:view",
  CUSTOMER_VIEW_OWN: "customer:view-own",
  CUSTOMER_NO_SELL_1M: "customer:no-sell-1m",
  CUSTOMER_NO_SELL_3M: "customer:no-sell-3m",
  CUSTOMER_NO_SELL_6M: "customer:no-sell-6m",
  // Export table buttons
  EXPORT_TABLES: "export:tables",
  // Stock transfer between locations
  INVENTORY_TRANSFER: "inventory:transfer",
  // Business locations (branches)
  LOCATION_VIEW: "location:view",
  LOCATION_MANAGE: "location:manage",
  // Purchases (goods received from suppliers)
  PURCHASE_VIEW: "purchase:view",
  PURCHASE_CREATE: "purchase:create",
  // Expenses
  EXPENSE_VIEW: "expense:view",
  EXPENSE_CREATE: "expense:create",
  // Cash register sessions
  REGISTER_OPEN: "register:open",
  REGISTER_CLOSE: "register:close",
  REGISTER_VIEW: "register:view",
  // Business/invoice/barcode/printer settings
  SETTINGS_MANAGE: "settings:manage",
  TAX_MANAGE: "tax:manage",
  // Sales returns
  SALES_RETURN_VIEW: "sales-return:view",
  SALES_RETURN_CREATE: "sales-return:create",
  // Quotations
  QUOTATION_VIEW: "quotation:view",
  QUOTATION_CREATE: "quotation:create",
  // Shipments
  SHIPMENT_MANAGE: "shipment:manage",
  // Checkout-time price override (damaged item, manager discretion)
  PRICE_OVERRIDE: "checkout:price-override",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// Used only as a fallback when a role has zero rows in `roles_permissions`
// at all (e.g. a fresh DB before prisma/seed.ts has run) — keeps the app
// usable pre-seed. Once any row exists for a role, that role is entirely
// DB-driven and this map is ignored for it.
const DEFAULT_GRANTS: Record<Role, PermissionKey[]> = {
  ADMIN: Object.values(PERMISSIONS),
  MANAGER: [
    PERMISSIONS.BILLS_REQUEST_CHANGE,
    PERMISSIONS.INVENTORY_ADJUST,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.INVENTORY_TRANSFER,
    PERMISSIONS.LOCATION_VIEW,
    PERMISSIONS.SUPPLIER_VIEW,
    PERMISSIONS.SUPPLIER_CREATE,
    PERMISSIONS.PURCHASE_VIEW,
    PERMISSIONS.PURCHASE_CREATE,
    PERMISSIONS.EXPENSE_VIEW,
    PERMISSIONS.EXPENSE_CREATE,
    PERMISSIONS.REGISTER_OPEN,
    PERMISSIONS.REGISTER_CLOSE,
    PERMISSIONS.REGISTER_VIEW,
    PERMISSIONS.SALES_RETURN_VIEW,
    PERMISSIONS.SALES_RETURN_CREATE,
    PERMISSIONS.QUOTATION_VIEW,
    PERMISSIONS.QUOTATION_CREATE,
    PERMISSIONS.SHIPMENT_MANAGE,
    PERMISSIONS.PRICE_OVERRIDE,
  ],
  CASHIER: [
    PERMISSIONS.BILLS_REQUEST_CHANGE,
    PERMISSIONS.INVENTORY_ADJUST,
    PERMISSIONS.EXPENSE_CREATE,
    PERMISSIONS.REGISTER_OPEN,
    PERMISSIONS.REGISTER_CLOSE,
    PERMISSIONS.REGISTER_VIEW,
    PERMISSIONS.SALES_RETURN_CREATE,
    PERMISSIONS.QUOTATION_CREATE,
  ],
};

/** Fetches every `roles_permissions` row once and reuses it for every
 * `checkPermission` call in the same request (React `cache()`). A page
 * that checks several permissions previously paid a full Supabase
 * round-trip (2 queries each, via Promise.all) per check — now it's one
 * query total, shared. Keyed by nothing (there's only ever one table to
 * fetch), so every caller in a request gets the same cached promise. */
const getAllRolePermissions = cache(async () => {
  return prisma.rolePermission.findMany();
});

/** Real implementation: looks up `roles_permissions` (see
 * prisma/schema.prisma → RolePermission), configurable at runtime via
 * /admin/settings/roles. Falls back to the static map above only if the
 * role has no rows configured yet at all. */
export async function checkPermission(
  role: Role,
  permission: PermissionKey,
): Promise<boolean> {
  const allGrants = await getAllRolePermissions();
  const rowsForRole = allGrants.filter((g) => g.role === role);

  if (rowsForRole.length === 0) {
    return DEFAULT_GRANTS[role]?.includes(permission) ?? false;
  }
  return rowsForRole.some((g) => g.permissionKey === permission);
}

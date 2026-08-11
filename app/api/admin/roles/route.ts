import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS, type PermissionKey } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";
import type { Role } from "@prisma/client";

const VALID_ROLES: Role[] = ["ADMIN", "MANAGER", "CASHIER"];

// manageRoles — POST /api/admin/roles (grant) and PATCH (revoke) — admin
// assigns roles/permissions per user. Writes directly to
// `roles_permissions`, which lib/auth/rbac.ts's checkPermission reads.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.ADMIN_MANAGE_ROLES))) {
    return apiError("FORBIDDEN", "Not allowed to manage roles", { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const role = body?.role as Role;
  const permissionKey = body?.permissionKey as PermissionKey;
  const thresholdValue = body?.thresholdValue != null ? Number(body.thresholdValue) : undefined;

  if (!VALID_ROLES.includes(role) || !Object.values(PERMISSIONS).includes(permissionKey)) {
    return apiError("INVALID_INPUT", "Valid role and permissionKey are required", { status: 400 });
  }

  const grant = await prisma.rolePermission.upsert({
    where: { role_permissionKey: { role, permissionKey } },
    update: { thresholdValue },
    create: { role, permissionKey, thresholdValue },
  });
  return apiSuccess(grant);
}

// Revoke a permission from a role.
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.ADMIN_MANAGE_ROLES))) {
    return apiError("FORBIDDEN", "Not allowed to manage roles", { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const role = body?.role as Role;
  const permissionKey = body?.permissionKey as PermissionKey;
  if (!VALID_ROLES.includes(role) || !permissionKey) {
    return apiError("INVALID_INPUT", "role and permissionKey are required", { status: 400 });
  }

  await prisma.rolePermission
    .delete({ where: { role_permissionKey: { role, permissionKey } } })
    .catch(() => null);
  return apiSuccess({ role, permissionKey, revoked: true });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  const grants = await prisma.rolePermission.findMany({ orderBy: [{ role: "asc" }, { permissionKey: "asc" }] });
  return apiSuccess(grants);
}

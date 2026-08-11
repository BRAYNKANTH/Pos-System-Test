import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";

// GET /api/admin/business-settings — the singleton settings blob (see
// BusinessSettings model comment in schema.prisma for why this is JSON
// rather than one column per field).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.SETTINGS_MANAGE))) {
    return apiError("FORBIDDEN", "Not allowed to view business settings", { status: 403 });
  }

  const row = await prisma.businessSettings.findUnique({ where: { id: "default" } });
  return apiSuccess(row?.data ?? {});
}

// PATCH /api/admin/business-settings — replaces the whole settings blob
// (the settings form always submits everything at once).
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.SETTINGS_MANAGE))) {
    return apiError("FORBIDDEN", "Not allowed to manage business settings", { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return apiError("INVALID_INPUT", "A settings object body is required", { status: 400 });
  }

  const row = await prisma.businessSettings.upsert({
    where: { id: "default" },
    update: { data: body },
    create: { id: "default", data: body },
  });
  return apiSuccess(row.data);
}

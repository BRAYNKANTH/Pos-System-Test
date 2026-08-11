import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.SETTINGS_MANAGE))) {
    return apiError("FORBIDDEN", "Not allowed to view invoice settings", { status: 403 });
  }

  const row = await prisma.invoiceSettings.findUnique({ where: { id: "default" } });
  return apiSuccess(row?.data ?? {});
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.SETTINGS_MANAGE))) {
    return apiError("FORBIDDEN", "Not allowed to manage invoice settings", { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return apiError("INVALID_INPUT", "A settings object body is required", { status: 400 });
  }

  const row = await prisma.invoiceSettings.upsert({
    where: { id: "default" },
    update: { data: body },
    create: { id: "default", data: body },
  });
  return apiSuccess(row.data);
}

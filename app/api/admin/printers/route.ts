import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.SETTINGS_MANAGE))) {
    return apiError("FORBIDDEN", "Not allowed to view printers", { status: 403 });
  }

  const printers = await prisma.printer.findMany({ orderBy: { createdAt: "asc" } });
  return apiSuccess(printers);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.SETTINGS_MANAGE))) {
    return apiError("FORBIDDEN", "Not allowed to manage printers", { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const connectionType = ["usb", "network", "bluetooth"].includes(body?.connectionType) ? body.connectionType : "usb";
  const paperWidthMm = Number(body?.paperWidthMm) || 80;
  const ipAddress = typeof body?.ipAddress === "string" && body.ipAddress.trim() ? body.ipAddress.trim() : undefined;
  const isDefault = Boolean(body?.isDefault);

  if (!name) return apiError("INVALID_INPUT", "name is required", { status: 400 });

  const created = await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await tx.printer.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    }
    return tx.printer.create({ data: { name, connectionType, paperWidthMm, ipAddress, isDefault } });
  });

  return apiSuccess(created, { status: 201 });
}

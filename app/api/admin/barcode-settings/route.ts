import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.SETTINGS_MANAGE))) {
    return apiError("FORBIDDEN", "Not allowed to view barcode settings", { status: 403 });
  }

  const row = await prisma.barcodeSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
  return apiSuccess(row);
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.SETTINGS_MANAGE))) {
    return apiError("FORBIDDEN", "Not allowed to manage barcode settings", { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const defaultType = typeof body?.defaultType === "string" ? body.defaultType : undefined;
  const prefix = typeof body?.prefix === "string" ? body.prefix : undefined;
  const labelWidthMm = body?.labelWidthMm !== undefined ? Number(body.labelWidthMm) : undefined;
  const labelHeightMm = body?.labelHeightMm !== undefined ? Number(body.labelHeightMm) : undefined;

  const row = await prisma.barcodeSettings.upsert({
    where: { id: "default" },
    update: { defaultType, prefix, labelWidthMm, labelHeightMm },
    create: {
      id: "default",
      defaultType: defaultType ?? "C128",
      prefix,
      labelWidthMm: labelWidthMm ?? 38,
      labelHeightMm: labelHeightMm ?? 25,
    },
  });
  return apiSuccess(row);
}

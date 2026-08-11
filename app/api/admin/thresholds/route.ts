import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";

// updateApprovalThresholds — PATCH /api/admin/thresholds — admin
// configures inventory/bill approval thresholds. Upserts by `scope`
// (lib/inventory/stock.ts currently reads the "default" scope row).
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.ADMIN_MANAGE_THRESHOLDS))) {
    return apiError("FORBIDDEN", "Not allowed to manage thresholds", { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const scope = typeof body?.scope === "string" ? body.scope : "";
  const thresholdType = body?.thresholdType;
  const value = Number(body?.value);

  if (!scope || !["percent", "absolute"].includes(thresholdType) || !Number.isFinite(value)) {
    return apiError(
      "INVALID_INPUT",
      "scope, thresholdType (percent/absolute), and value are required",
      { status: 400 },
    );
  }

  const existing = await prisma.approvalThreshold.findFirst({ where: { scope } });
  const threshold = existing
    ? await prisma.approvalThreshold.update({
        where: { id: existing.id },
        data: { thresholdType, value },
      })
    : await prisma.approvalThreshold.create({ data: { scope, thresholdType, value } });

  return apiSuccess(threshold);
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  const thresholds = await prisma.approvalThreshold.findMany();
  return apiSuccess(thresholds);
}

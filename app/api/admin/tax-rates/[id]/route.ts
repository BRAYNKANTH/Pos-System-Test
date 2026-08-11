import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";

// PATCH /api/admin/tax-rates/:id
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.TAX_MANAGE))) {
    return apiError("FORBIDDEN", "Not allowed to manage tax rates", { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : undefined;
  const ratePercent = body?.rate !== undefined ? Number(body.rate) : undefined;
  const rateType = body?.rateType === "Fixed" || body?.rateType === "Percentage" ? body.rateType : undefined;
  const isDefault = typeof body?.isDefault === "boolean" ? body.isDefault : undefined;

  if (ratePercent !== undefined && (!Number.isFinite(ratePercent) || ratePercent < 0)) {
    return apiError("INVALID_INPUT", "rate must be a non-negative number", { status: 400 });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.taxRule.updateMany({ where: { isDefault: true, id: { not: id } }, data: { isDefault: false } });
      }
      return tx.taxRule.update({
        where: { id },
        data: {
          name,
          rate: ratePercent !== undefined ? ratePercent / 100 : undefined,
          rateType,
          isDefault,
        },
      });
    });
    return apiSuccess(updated);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return apiError("NOT_FOUND", "Tax rate not found", { status: 404 });
    }
    console.error("Failed to update tax rate", err);
    return apiError("UPDATE_FAILED", "Failed to update tax rate", { status: 500 });
  }
}

// DELETE /api/admin/tax-rates/:id — blocked for the default rate (checkout
// needs at least one to fall back on).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.TAX_MANAGE))) {
    return apiError("FORBIDDEN", "Not allowed to manage tax rates", { status: 403 });
  }

  const { id } = await params;
  const rate = await prisma.taxRule.findUnique({ where: { id } });
  if (!rate) return apiError("NOT_FOUND", "Tax rate not found", { status: 404 });
  if (rate.isDefault) {
    return apiError("DEFAULT_RATE", "Set a different rate as default before deleting this one", { status: 409 });
  }

  await prisma.taxRule.delete({ where: { id } });
  return apiSuccess({ id });
}

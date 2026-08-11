import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";

// GET /api/admin/tax-rates — list, used by the settings page.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.TAX_MANAGE))) {
    return apiError("FORBIDDEN", "Not allowed to view tax rates", { status: 403 });
  }

  const rates = await prisma.taxRule.findMany({ orderBy: { createdAt: "asc" } });
  return apiSuccess(rates);
}

// POST /api/admin/tax-rates — create a tax rate. Setting isDefault:true
// automatically unsets it on every other rate (checkout only ever uses
// the one rule flagged default — see app/api/pos/checkout).
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.TAX_MANAGE))) {
    return apiError("FORBIDDEN", "Not allowed to manage tax rates", { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const ratePercent = Number(body?.rate);
  // "Fixed" here is a display label carried over from the reference
  // system's mock UI, not a distinct calculation mode — the pricing
  // engine (lib/pos/pricing.ts calculateTax) only ever multiplies against
  // the line subtotal, so every rate is stored as a percentage fraction
  // regardless of this label. A rate of 0 (e.g. "Zero Rated") works fine
  // either way.
  const rateType = body?.rateType === "Fixed" ? "Fixed" : "Percentage";
  const region = typeof body?.region === "string" && body.region.trim() ? body.region.trim() : "default";
  const category = typeof body?.category === "string" && body.category.trim() ? body.category.trim() : "default";
  const isDefault = Boolean(body?.isDefault);

  if (!name || !Number.isFinite(ratePercent) || ratePercent < 0) {
    return apiError("INVALID_INPUT", "name and a non-negative rate are required", { status: 400 });
  }

  const created = await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await tx.taxRule.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    }
    return tx.taxRule.create({
      data: {
        name,
        rate: ratePercent / 100,
        rateType,
        region,
        category,
        isDefault,
      },
    });
  });

  return apiSuccess(created, { status: 201 });
}

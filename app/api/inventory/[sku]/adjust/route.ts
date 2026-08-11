import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";
import { submitManualAdjustment, InsufficientStockError, UnknownSkuError } from "@/lib/inventory/stock";

// submitManualAdjustment — POST /api/inventory/:sku/adjust — staff submits
// stock take/damage/spoilage/correction. Held for approval automatically
// if it's over the configured threshold (see checkThreshold in
// lib/inventory/stock.ts).
export async function POST(req: NextRequest, { params }: { params: Promise<{ sku: string }> }) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.INVENTORY_ADJUST))) {
    return apiError("FORBIDDEN", "Not allowed to adjust inventory", { status: 403 });
  }

  const { sku } = await params;
  const body = await req.json().catch(() => null);
  const qtyChange = Number(body?.qtyChange);
  const reasonCategory = typeof body?.reasonCategory === "string" ? body.reasonCategory : "";

  if (!Number.isFinite(qtyChange) || qtyChange === 0 || !reasonCategory) {
    return apiError("INVALID_INPUT", "qtyChange (non-zero) and reasonCategory are required", {
      status: 400,
    });
  }

  try {
    const result = await submitManualAdjustment({
      sku,
      qtyChange,
      reasonCategory,
      requestedBy: user.id,
    });
    return apiSuccess(result);
  } catch (err) {
    if (err instanceof UnknownSkuError) {
      return apiError("UNKNOWN_SKU", err.message, { status: 400 });
    }
    if (err instanceof InsufficientStockError) {
      return apiError("INSUFFICIENT_STOCK", err.message, { status: 409 });
    }
    console.error("submitManualAdjustment failed", err);
    return apiError("ADJUSTMENT_FAILED", "Failed to submit adjustment", { status: 500 });
  }
}

import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";
import { increaseStockOnReceipt } from "@/lib/inventory/stock";

// increaseStockOnReceipt — POST /api/inventory/goods-receipt — automated
// increase from purchase orders.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.INVENTORY_ADJUST))) {
    return apiError("FORBIDDEN", "Not allowed to receive stock", { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const sku = typeof body?.sku === "string" ? body.sku : "";
  const qty = Number(body?.qty);
  if (!sku || !Number.isFinite(qty) || qty <= 0) {
    return apiError("INVALID_INPUT", "sku and a positive qty are required", { status: 400 });
  }

  try {
    await increaseStockOnReceipt(sku, qty);
    return apiSuccess({ sku, qty });
  } catch (err) {
    console.error("increaseStockOnReceipt failed", err);
    return apiError("RECEIPT_FAILED", "Failed to record goods receipt", { status: 500 });
  }
}

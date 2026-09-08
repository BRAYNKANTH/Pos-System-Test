import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";
import { createSalesReturn, TransactionNotFoundError, InvalidReturnQtyError, UnknownExchangeSkuError, NonReturnableItemError } from "@/lib/sales/returns";
import { InsufficientStockError } from "@/lib/inventory/stock";
import { verifyManagerPin } from "@/lib/auth/managerPin";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.SALES_RETURN_VIEW))) {
    return apiError("FORBIDDEN", "Not allowed to view sales returns", { status: 403 });
  }

  const returns = await prisma.salesReturn.findMany({
    include: { items: true, transaction: { include: { customer: true } }, createdBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return apiSuccess(returns);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.SALES_RETURN_CREATE))) {
    return apiError("FORBIDDEN", "Not allowed to create sales returns", { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const transactionId = typeof body?.transactionId === "string" ? body.transactionId : "";
  const items = Array.isArray(body?.items)
    ? body.items
        .map((i: { sku?: unknown; qty?: unknown }) => ({ sku: String(i?.sku ?? ""), qty: Number(i?.qty) }))
        .filter((i: { sku: string; qty: number }) => i.sku && Number.isFinite(i.qty) && i.qty > 0)
    : [];
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  const refundMethod = typeof body?.refundMethod === "string" ? body.refundMethod : "cash";
  const requestedOverride = Boolean(body?.allowNonReturnableOverride);
  const managerPin = typeof body?.managerPin === "string" ? body.managerPin.trim() : "";

  // The client's "Supervisor Override" checkbox is UI-only convenience —
  // it used to be trusted as-is, letting any cashier tick it themselves
  // with no actual manager involvement. This re-verifies the PIN at the
  // point of use rather than trusting a client claim that a manager
  // approved it in some earlier, separate request.
  let allowNonReturnableOverride = false;
  if (requestedOverride) {
    if (!managerPin) {
      return apiError("MANAGER_PIN_REQUIRED", "A manager PIN is required to override a Final Sale item", { status: 403 });
    }
    const pinResult = await verifyManagerPin(managerPin);
    if (!pinResult.ok) {
      return apiError("UNAUTHORIZED_PIN", "Invalid manager PIN", { status: 403 });
    }
    allowNonReturnableOverride = true;
  }
  const exchangeItems = Array.isArray(body?.exchangeItems)
    ? body.exchangeItems
        .map((i: { sku?: unknown; qty?: unknown }) => ({ sku: String(i?.sku ?? ""), qty: Number(i?.qty) }))
        .filter((i: { sku: string; qty: number }) => i.sku && Number.isFinite(i.qty) && i.qty > 0)
    : [];
  const netPaymentMethod = typeof body?.netPaymentMethod === "string" ? body.netPaymentMethod : undefined;

  if (!transactionId || items.length === 0 || !reason) {
    return apiError("INVALID_INPUT", "transactionId, at least one item, and reason are required", { status: 400 });
  }

  try {
    const result = await createSalesReturn({
      transactionId,
      items,
      reason,
      refundMethod,
      createdById: user.id,
      allowNonReturnableOverride,
      exchangeItems: exchangeItems.length > 0 ? exchangeItems : undefined,
      netPaymentMethod,
    });
    return apiSuccess(result, { status: 201 });
  } catch (err) {
    if (err instanceof TransactionNotFoundError) {
      return apiError("NOT_FOUND", err.message, { status: 404 });
    }
    if (err instanceof NonReturnableItemError) {
      return apiError("NON_RETURNABLE", err.message, { status: 422 });
    }
    if (err instanceof InvalidReturnQtyError) {
      return apiError("INVALID_QTY", err.message, { status: 409 });
    }
    if (err instanceof UnknownExchangeSkuError) {
      return apiError("UNKNOWN_SKU", err.message, { status: 400 });
    }
    if (err instanceof InsufficientStockError) {
      return apiError("INSUFFICIENT_STOCK", `Not enough stock for ${err.sku} to complete the exchange`, { status: 409 });
    }
    console.error("createSalesReturn failed", err);
    return apiError("RETURN_FAILED", "Failed to record sales return", { status: 500 });
  }
}

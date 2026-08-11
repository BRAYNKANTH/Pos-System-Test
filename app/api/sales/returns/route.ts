import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";
import { createSalesReturn, TransactionNotFoundError, InvalidReturnQtyError } from "@/lib/sales/returns";

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

  if (!transactionId || items.length === 0 || !reason) {
    return apiError("INVALID_INPUT", "transactionId, at least one item, and reason are required", { status: 400 });
  }

  try {
    // Not queued to Zoho — sales returns aren't one of the Zoho sync
    // entity types (transaction/bill/stock_adjustment/customer); the
    // restock itself already writes a StockAdjustment which the existing
    // inventory-approval sync path would need extending to pick up.
    // Flagged as a known gap rather than enqueueing a job that would
    // silently no-op.
    const result = await createSalesReturn({ transactionId, items, reason, refundMethod, createdById: user.id });
    return apiSuccess(result, { status: 201 });
  } catch (err) {
    if (err instanceof TransactionNotFoundError) {
      return apiError("NOT_FOUND", err.message, { status: 404 });
    }
    if (err instanceof InvalidReturnQtyError) {
      return apiError("INVALID_QTY", err.message, { status: 409 });
    }
    console.error("createSalesReturn failed", err);
    return apiError("RETURN_FAILED", "Failed to record sales return", { status: 500 });
  }
}

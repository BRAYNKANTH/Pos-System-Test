import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError, errorMessage } from "@/lib/api-response";
import { increaseStockOnReceipt } from "@/lib/inventory/stock";
import { InvalidSerialError } from "@/lib/inventory/serials";

// increaseStockOnReceipt — POST /api/inventory/goods-receipt — automated
// increase from purchase orders. Also the only place batch numbers and
// serial numbers can be registered for batch/serial-tracked products —
// see lib/inventory/stock.ts's increaseStockOnReceipt docs.
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

  const item = await prisma.inventoryItem.findUnique({ where: { sku } });
  if (!item) return apiError("UNKNOWN_SKU", `Unknown SKU: ${sku}`, { status: 400 });

  const batchNumber = typeof body?.batchNumber === "string" && body.batchNumber.trim() ? body.batchNumber.trim() : undefined;
  const expiryDate = typeof body?.expiryDate === "string" && body.expiryDate ? new Date(body.expiryDate) : undefined;
  const costPrice = Number.isFinite(Number(body?.costPrice)) && body?.costPrice !== undefined ? Number(body.costPrice) : undefined;
  // The selling price for this specific batch — omit (or send the same
  // value as the catalog price) when this batch should just sell at
  // whatever the product's normal price is; see ItemBatch.unitPrice's docs.
  const batchUnitPrice = Number.isFinite(Number(body?.batchUnitPrice)) && body?.batchUnitPrice !== undefined ? Number(body.batchUnitPrice) : undefined;

  if (item.trackBatch && !batchNumber) {
    return apiError("BATCH_REQUIRED", `${sku} is batch/lot-tracked — a batch number is required to receive stock`, { status: 400 });
  }

  const serialNumbers = Array.isArray(body?.serialNumbers)
    ? body.serialNumbers.map((s: unknown) => String(s).trim()).filter(Boolean)
    : [];

  if (item.trackSerial) {
    if (serialNumbers.length !== qty) {
      return apiError(
        "SERIAL_COUNT_MISMATCH",
        `${sku} is serial-tracked — exactly ${qty} serial number(s) are required (got ${serialNumbers.length})`,
        { status: 400 },
      );
    }
    const uniqueCount = new Set(serialNumbers).size;
    if (uniqueCount !== serialNumbers.length) {
      return apiError("DUPLICATE_SERIAL", "Duplicate serial numbers in this receipt", { status: 400 });
    }
  }

  try {
    await increaseStockOnReceipt(sku, qty, {
      batch: batchNumber ? { batchNumber, expiryDate, costPrice, unitPrice: batchUnitPrice } : undefined,
      serialNumbers: serialNumbers.length > 0 ? serialNumbers : undefined,
    });
    return apiSuccess({ sku, qty });
  } catch (err) {
    if (err instanceof InvalidSerialError) {
      return apiError("INVALID_SERIAL", err.message, { status: 409 });
    }
    console.error("increaseStockOnReceipt failed", err);
    return apiError("RECEIPT_FAILED", errorMessage(err, "Failed to record goods receipt"), { status: 500 });
  }
}

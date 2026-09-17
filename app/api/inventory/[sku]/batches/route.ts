import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";
import { increaseStockOnReceipt } from "@/lib/inventory/stock";

// GET /api/inventory/[sku]/batches — the in-stock batches/lots for one
// product, for the POS batch picker (see CartPanel's line-edit popup).
// Any logged-in user can read this — like /api/pos/products, it's
// point-of-sale catalog data every cashier needs to ring up a sale, not an
// admin-only inventory-management view, so this isn't gated behind
// INVENTORY_ADJUST the way actually changing stock is.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sku: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });

  const { sku } = await params;
  if (!sku) return apiError("INVALID_INPUT", "SKU is required", { status: 400 });

  const batches = await prisma.itemBatch.findMany({
    where: { sku, qtyOnHand: { gt: 0 } },
    orderBy: [{ expiryDate: "asc" }, { createdAt: "asc" }],
  });

  return apiSuccess(
    batches.map((b) => ({
      batchNumber: b.batchNumber,
      qtyOnHand: b.qtyOnHand,
      expiryDate: b.expiryDate,
      // null here means "no batch-specific price — sells at the
      // product's normal catalog price," not "free" or "unknown."
      unitPrice: b.unitPrice !== null ? Number(b.unitPrice) : null,
    })),
  );
}

// POST /api/inventory/[sku]/batches — manually create a new batch/lot or
// top up an existing one, outside of a goods-receipt purchase order (the
// item detail page's Batches panel) — reuses the exact same
// increaseStockOnReceipt path goods receipt itself uses, so
// InventoryItem.qtyOnHand, the location breakdown, and the audit trail
// all stay in sync the same way. Admin-only-ish (INVENTORY_ADJUST) since
// it's a direct stock change, not a read.
export async function POST(req: NextRequest, { params }: { params: Promise<{ sku: string }> }) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.INVENTORY_ADJUST))) {
    return apiError("FORBIDDEN", "Not allowed to add batch stock", { status: 403 });
  }

  const { sku } = await params;
  const item = await prisma.inventoryItem.findUnique({ where: { sku } });
  if (!item) return apiError("NOT_FOUND", "Product not found", { status: 404 });
  if (!item.trackBatch) {
    return apiError("NOT_BATCH_TRACKED", "This product isn't batch/lot-tracked — enable that in Edit Product first", { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const batchNumber = typeof body?.batchNumber === "string" ? body.batchNumber.trim() : "";
  const qty = Number(body?.qty);
  const expiryDate = body?.expiryDate ? new Date(body.expiryDate) : undefined;
  const costPrice = body?.costPrice !== undefined && body.costPrice !== "" ? Number(body.costPrice) : undefined;
  const unitPrice = body?.unitPrice !== undefined && body.unitPrice !== "" ? Number(body.unitPrice) : undefined;

  if (!batchNumber) return apiError("INVALID_INPUT", "Batch/lot number is required", { status: 400 });
  if (!Number.isFinite(qty) || qty <= 0) return apiError("INVALID_INPUT", "Quantity must be a positive number", { status: 400 });

  try {
    await increaseStockOnReceipt(sku, qty, { batch: { batchNumber, expiryDate, costPrice, unitPrice } });
    const batch = await prisma.itemBatch.findUnique({ where: { sku_batchNumber: { sku, batchNumber } } });
    return apiSuccess(batch, { status: 201 });
  } catch (err) {
    console.error("addBatch failed", err);
    return apiError("ADD_FAILED", "Failed to add batch stock", { status: 500 });
  }
}

import type { NextRequest } from "next/server";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";

// PATCH /api/inventory/[sku]/batches/[batchNumber] — correct a batch's
// recorded quantity, cost/selling price, or expiry date directly (a
// stock-take correction on one specific lot, or fixing a data-entry
// mistake) — distinct from receiving more of it (POST on the parent
// route, which goes through the normal goods-receipt path instead).
// Changing qtyOnHand here keeps InventoryItem.qtyOnHand in lockstep and
// leaves a StockAdjustment audit row, same discipline every other
// stock-changing path in this app follows.
export async function PATCH(req: NextRequest, props: { params: Promise<{ sku: string; batchNumber: string }> }) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.INVENTORY_ADJUST))) {
    return apiError("FORBIDDEN", "Not allowed to adjust batch stock", { status: 403 });
  }

  const { sku, batchNumber } = await props.params;
  const body = await req.json().catch(() => null);
  const newQty = body?.qtyOnHand !== undefined ? Number(body.qtyOnHand) : undefined;
  const costPrice = body?.costPrice !== undefined ? Number(body.costPrice) : undefined;
  const unitPrice = body?.unitPrice === null ? null : body?.unitPrice !== undefined ? Number(body.unitPrice) : undefined;
  const expiryDate = body?.expiryDate === null ? null : body?.expiryDate ? new Date(body.expiryDate) : undefined;

  if (newQty !== undefined && (!Number.isFinite(newQty) || newQty < 0)) {
    return apiError("INVALID_INPUT", "qtyOnHand must be zero or a positive number", { status: 400 });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const batch = await tx.itemBatch.findUnique({ where: { sku_batchNumber: { sku, batchNumber } } });
      if (!batch) throw new Error("NOT_FOUND");

      if (newQty !== undefined && newQty !== batch.qtyOnHand) {
        const delta = newQty - batch.qtyOnHand;
        const invResult = await tx.inventoryItem.updateMany({
          where: { sku, qtyOnHand: { gte: delta < 0 ? -delta : 0 } },
          data: { qtyOnHand: { increment: delta } },
        });
        if (invResult.count === 0) throw new Error("INSUFFICIENT_STOCK");
        await tx.stockAdjustment.create({
          data: {
            sku,
            qtyChange: delta,
            type: "automated",
            reasonCategory: "batch_correction",
            status: "applied",
          },
        });
      }

      return tx.itemBatch.update({
        where: { id: batch.id },
        data: {
          ...(newQty !== undefined && { qtyOnHand: newQty }),
          ...(costPrice !== undefined && { costPrice }),
          ...(unitPrice !== undefined && { unitPrice }),
          ...(expiryDate !== undefined && { expiryDate }),
        },
      });
    }, TRANSACTION_OPTIONS);

    return apiSuccess(updated);
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return apiError("NOT_FOUND", "Batch not found", { status: 404 });
    }
    if (err instanceof Error && err.message === "INSUFFICIENT_STOCK") {
      return apiError("INSUFFICIENT_STOCK", "That reduction would take the product's total stock below zero", { status: 409 });
    }
    console.error("updateBatch failed", err);
    return apiError("UPDATE_FAILED", "Failed to update batch", { status: 500 });
  }
}

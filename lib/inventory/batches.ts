import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export class InsufficientBatchStockError extends Error {
  constructor(public sku: string) {
    super(`Not enough batch-tracked stock on hand for ${sku} to fulfill this sale`);
  }
}

/**
 * Get available batches for a SKU sorted by expiry date (FIFO)
 */
export async function getAvailableBatches(sku: string) {
  return prisma.itemBatch.findMany({
    where: { sku, qtyOnHand: { gt: 0 } },
    orderBy: [
      { expiryDate: "asc" },
      { createdAt: "asc" },
    ],
  });
}

/**
 * Deduct stock from a specific batch, or FIFO across batches (oldest
 * expiry first) when no specific batch is named or it doesn't have
 * enough on its own.
 *
 * Throws InsufficientBatchStockError rather than silently doing nothing
 * when there isn't enough batch-tracked stock to cover `qty` — this used
 * to return quietly whenever the specified batch was short or no batches
 * existed at all, which let the batch ledger drift out of sync with the
 * real (main) stock count: the sale would still go through and decrement
 * the main InventoryItem.qtyOnHand normally, while the per-batch numbers
 * silently failed to move, with no error or record of the mismatch.
 */
export async function deductBatchStock(
  tx: Prisma.TransactionClient,
  sku: string,
  qty: number,
  specifiedBatchNumber?: string,
) {
  if (qty <= 0) return;

  if (specifiedBatchNumber) {
    const batch = await tx.itemBatch.findUnique({
      where: { sku_batchNumber: { sku, batchNumber: specifiedBatchNumber } },
    });
    if (batch && batch.qtyOnHand >= qty) {
      await tx.itemBatch.update({
        where: { id: batch.id },
        data: { qtyOnHand: { decrement: qty } },
      });
      return;
    }
    // Falls through to FIFO across all batches when the named batch
    // doesn't have enough on its own (e.g. selling the last few units of
    // one lot plus the start of the next) — nothing has been deducted
    // from it yet, so this can't double-count.
  }

  // FIFO fallback
  const batches = await tx.itemBatch.findMany({
    where: { sku, qtyOnHand: { gt: 0 } },
    orderBy: [{ expiryDate: "asc" }, { createdAt: "asc" }],
  });

  let remainingToDeduct = qty;
  for (const b of batches) {
    if (remainingToDeduct <= 0) break;
    const deductFromThis = Math.min(b.qtyOnHand, remainingToDeduct);
    await tx.itemBatch.update({
      where: { id: b.id },
      data: { qtyOnHand: { decrement: deductFromThis } },
    });
    remainingToDeduct -= deductFromThis;
  }

  if (remainingToDeduct > 0) {
    throw new InsufficientBatchStockError(sku);
  }
}

/**
 * Restock quantity to batch — called from goods receipt when the
 * delivered items are batch/lot-tracked (see
 * lib/inventory/stock.ts's increaseStockOnReceipt).
 */
export async function restockBatch(
  tx: Prisma.TransactionClient,
  sku: string,
  qty: number,
  batchNumber: string,
  expiryDate?: Date,
  costPrice?: number,
) {
  if (qty <= 0) return;

  await tx.itemBatch.upsert({
    where: { sku_batchNumber: { sku, batchNumber } },
    create: {
      sku,
      batchNumber,
      qtyOnHand: qty,
      expiryDate,
      costPrice,
    },
    update: {
      qtyOnHand: { increment: qty },
      ...(expiryDate ? { expiryDate } : {}),
      ...(costPrice !== undefined ? { costPrice } : {}),
    },
  });
}

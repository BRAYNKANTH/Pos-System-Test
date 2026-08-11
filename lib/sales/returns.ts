import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import { creditDefaultLocation } from "@/lib/inventory/locationStock";

export class TransactionNotFoundError extends Error {
  constructor() {
    super("Transaction not found");
  }
}

export class InvalidReturnQtyError extends Error {
  constructor(public sku: string) {
    super(`Return quantity for ${sku} exceeds what was sold (minus already-returned quantity)`);
  }
}

/** createSalesReturn — everyday "customer brought an item back" counter
 * flow, distinct from the admin-approval BillChangeRequest workflow.
 * Restocks the returned quantities (qtyOnHand + default location
 * breakdown) and computes a fair refund: each returned unit refunds its
 * original per-unit net price (post-discount, pre-tax) plus its share of
 * tax, proportional to the line's original discount/tax — not just
 * qty × list price. */
export async function createSalesReturn(params: {
  transactionId: string;
  items: { sku: string; qty: number }[];
  reason: string;
  refundMethod: string;
  createdById: string;
}) {
  return prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.findUnique({
      where: { id: params.transactionId },
      include: { items: true },
    });
    if (!transaction) throw new TransactionNotFoundError();

    const priorReturns = await tx.salesReturnItem.findMany({
      where: { return: { transactionId: params.transactionId } },
    });
    const priorReturnedBySku = new Map<string, number>();
    for (const r of priorReturns) {
      priorReturnedBySku.set(r.sku, (priorReturnedBySku.get(r.sku) ?? 0) + r.qty);
    }

    let refundAmount = 0;
    const returnItemsData: { sku: string; qty: number; unitPrice: number }[] = [];

    for (const reqItem of params.items) {
      const line = transaction.items.find((i) => i.sku === reqItem.sku);
      if (!line) throw new InvalidReturnQtyError(reqItem.sku);

      const alreadyReturned = priorReturnedBySku.get(reqItem.sku) ?? 0;
      const remainingReturnable = line.qty - alreadyReturned;
      if (reqItem.qty <= 0 || reqItem.qty > remainingReturnable) {
        throw new InvalidReturnQtyError(reqItem.sku);
      }

      const netLineTotal = Number(line.unitPrice) * line.qty - Number(line.discount) + Number(line.taxAmount);
      const perUnitNet = netLineTotal / line.qty;
      refundAmount += perUnitNet * reqItem.qty;

      returnItemsData.push({ sku: reqItem.sku, qty: reqItem.qty, unitPrice: Number(line.unitPrice) });

      // Restock — same system-wide total + default-location bookkeeping
      // as every other stock-increasing path (see lib/inventory/stock.ts).
      await tx.inventoryItem.update({
        where: { sku: reqItem.sku },
        data: { qtyOnHand: { increment: reqItem.qty } },
      });
      await tx.stockAdjustment.create({
        data: {
          sku: reqItem.sku,
          qtyChange: reqItem.qty,
          type: "automated",
          reasonCategory: "sales_return",
          status: "applied",
        },
      });
      await creditDefaultLocation(tx, reqItem.sku, reqItem.qty);
    }

    refundAmount = Math.round(refundAmount * 100) / 100;

    return tx.salesReturn.create({
      data: {
        transactionId: params.transactionId,
        reason: params.reason,
        refundAmount,
        refundMethod: params.refundMethod,
        createdById: params.createdById,
        items: { create: returnItemsData },
      },
      include: { items: true },
    });
  }, TRANSACTION_OPTIONS);
}

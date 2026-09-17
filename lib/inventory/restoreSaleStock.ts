import type { Prisma, TransactionItem } from "@prisma/client";
import { creditDefaultLocation } from "./locationStock";

export class StockRestorationError extends Error {}

/** Restore the receipt units used by return pricing, including partial lines. */
export async function restoreSaleStock(tx: Prisma.TransactionClient, transactionId: string, line: TransactionItem,
  qty: number, offset: number, reasonCategory: "sales_return" | "sale_void") {
  if (!Number.isSafeInteger(qty) || qty <= 0 || offset < 0 || offset + qty > line.qty) {
    throw new StockRestorationError("Invalid stock restoration quantity");
  }
  const product = await tx.inventoryItem.findUniqueOrThrow({ where: { sku: line.sku } });
  if (line.batchNumber) {
    const restored = await tx.itemBatch.updateMany({ where: { sku: line.sku, batchNumber: line.batchNumber }, data: { qtyOnHand: { increment: qty } } });
    if (restored.count !== 1) throw new StockRestorationError(`Original batch ${line.batchNumber} for ${line.sku} is missing. Reconcile the batch before returning this sale.`);
  } else if (product.trackBatch) {
    throw new StockRestorationError(`Sale has no original batch for ${line.sku}. Reconcile this legacy sale before returning it.`);
  }
  const serials = Array.isArray(line.serialNumbers) ? line.serialNumbers.filter((s): s is string => typeof s === "string").map(s => s.trim()) : [];
  if (serials.length || product.trackSerial) {
    if (serials.length !== line.qty || new Set(serials).size !== serials.length) {
      throw new StockRestorationError(`Sale has incomplete serial details for ${line.sku}. Reconcile this legacy sale before returning it.`);
    }
    for (const serialNumber of serials.slice(offset, offset + qty)) {
      const restored = await tx.itemSerial.updateMany({ where: { sku: line.sku, serialNumber, transactionId, status: "sold" }, data: { status: "available", transactionId: null } });
      if (restored.count !== 1) throw new StockRestorationError(`Serial ${serialNumber} is no longer sold against this receipt. Review its stock history.`);
    }
  }
  await tx.inventoryItem.update({ where: { sku: line.sku }, data: { qtyOnHand: { increment: qty } } });
  await creditDefaultLocation(tx, line.sku, qty);
  await tx.stockAdjustment.create({ data: { sku: line.sku, qtyChange: qty, type: "automated", reasonCategory, status: "applied" } });
}

import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import { creditDefaultLocation, debitDefaultLocationBestEffort } from "@/lib/inventory/locationStock";
import { InsufficientStockError } from "@/lib/inventory/stock";

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

export class UnknownExchangeSkuError extends Error {
  constructor(public sku: string) {
    super(`Unknown SKU: ${sku}`);
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
  /** Exchange — the replacement item(s) going out in the same operation
   * as the return coming in. Omit/empty for a plain refund-only return. */
  exchangeItems?: { sku: string; qty: number }[];
  netPaymentMethod?: string;
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

    // Exchange: replacement item(s) go out in the same operation as the
    // returned item(s) come in — race-safe stock deduction, same pattern
    // as a normal sale (lib/inventory/stock.ts deductStockOnSale), just
    // inlined here with its own reasonCategory so it reads distinctly in
    // the Stock Adjustment Report.
    const exchangeItems = params.exchangeItems ?? [];
    let exchangeTotal = 0;
    const exchangeItemsData: { sku: string; qty: number; unitPrice: number }[] = [];

    for (const exItem of exchangeItems) {
      if (exItem.qty <= 0) continue;
      const item = await tx.inventoryItem.findUnique({ where: { sku: exItem.sku } });
      if (!item) throw new UnknownExchangeSkuError(exItem.sku);

      const result = await tx.inventoryItem.updateMany({
        where: { sku: exItem.sku, qtyOnHand: { gte: exItem.qty } },
        data: { qtyOnHand: { decrement: exItem.qty } },
      });
      if (result.count === 0) throw new InsufficientStockError(exItem.sku);

      await tx.stockAdjustment.create({
        data: {
          sku: exItem.sku,
          qtyChange: -exItem.qty,
          type: "automated",
          reasonCategory: "exchange_out",
          status: "applied",
        },
      });
      await debitDefaultLocationBestEffort(tx, exItem.sku, exItem.qty);

      const unitPrice = Number(item.unitPrice);
      exchangeTotal += unitPrice * exItem.qty;
      exchangeItemsData.push({ sku: exItem.sku, qty: exItem.qty, unitPrice });
    }

    exchangeTotal = Math.round(exchangeTotal * 100) / 100;
    const netAmount = Math.round((exchangeTotal - refundAmount) * 100) / 100;

    return tx.salesReturn.create({
      data: {
        transactionId: params.transactionId,
        reason: params.reason,
        refundAmount,
        refundMethod: params.refundMethod,
        createdById: params.createdById,
        isExchange: exchangeItemsData.length > 0,
        exchangeTotal,
        netAmount,
        netPaymentMethod: exchangeItemsData.length > 0 ? params.netPaymentMethod ?? "cash" : null,
        items: { create: returnItemsData },
        exchangeItems: { create: exchangeItemsData },
      },
      include: { items: true, exchangeItems: true },
    });
  }, TRANSACTION_OPTIONS);
}

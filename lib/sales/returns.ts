import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import { debitDefaultLocationBestEffort } from "@/lib/inventory/locationStock";
import { InsufficientStockError } from "@/lib/inventory/stock";
import { issueStoreCredit } from "@/lib/customers/storeCredit";
import { restoreSaleStock } from "@/lib/inventory/restoreSaleStock";
import { deductBatchStock } from "@/lib/inventory/batches";
import { validateAndAssignSerials } from "@/lib/inventory/serials";
import { priceReturn } from "./return-pricing";

export class TransactionNotFoundError extends Error {
  constructor() {
    super("Transaction not found");
  }
}

export class InvalidReturnInputError extends Error {}

export class InvalidReturnQtyError extends Error {
  constructor(public sku: string) {
    super(`Return quantity for ${sku} exceeds what was sold (minus already-returned quantity)`);
  }
}

export class NonReturnableItemError extends Error {
  constructor(public sku: string) {
    super(`Item ${sku} is marked as Final Sale / Non-Returnable`);
  }
}

export class UnknownExchangeSkuError extends Error {
  constructor(public sku: string) {
    super(`Unknown SKU: ${sku}`);
  }
}

export class StoreCreditRequiresCustomerError extends Error {
  constructor() {
    super("A store credit refund needs a registered customer on the original sale — this one was Walk-In");
  }
}

/** createSalesReturn — everyday "customer brought an item back" counter
 * flow, distinct from a full sale void (see VoidSaleButton).
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
  allowNonReturnableOverride?: boolean;
  confirmedTrackedUnits?: boolean;
  /** Exchange — the replacement item(s) going out in the same operation
   * as the return coming in. Omit/empty for a plain refund-only return. */
  exchangeItems?: { sku: string; qty: number; batchNumber?: string; serialNumbers?: string[] }[];
  netPaymentMethod?: string;
}) {
  if (!params.items.length || !["cash", "card", "wallet", "store_credit"].includes(params.refundMethod)
    || (params.netPaymentMethod !== undefined && !["cash", "card", "wallet"].includes(params.netPaymentMethod))) {
    throw new InvalidReturnInputError("Select a valid refund/payment method and at least one item");
  }
  return prisma.$transaction(async (tx) => {
    // pg_advisory_xact_lock returns void — $queryRaw fails trying to
    // deserialize a void-typed result column, which broke every return.
    // $executeRaw doesn't read back rows, so it's the correct call here:
    // only the lock's side effect matters, never its return value.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${params.transactionId}))`;
    const transaction = await tx.transaction.findUnique({
      where: { id: params.transactionId },
      include: { items: { orderBy: { id: "asc" } } },
    });
    if (!transaction) throw new TransactionNotFoundError();
    if (transaction.status !== "completed") throw new TransactionNotFoundError();
    // Only a plain (non-exchange) return can actually pay out as store
    // credit — see the note by issueStoreCredit's call below — so an
    // exchange with refundMethod left at "store_credit" (the field isn't
    // hidden in exchange mode, it's just not consulted) shouldn't be
    // blocked by this Walk-In check when it'll never issue a credit note.
    const isPlainReturn = !params.exchangeItems || params.exchangeItems.length === 0;
    if (isPlainReturn && params.refundMethod === "store_credit" && !transaction.customerId) {
      throw new StoreCreditRequiresCustomerError();
    }

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
      // A sale can have more than one TransactionItem row for the same
      // sku — two separately-weighed bags, two serialized units — each
      // possibly sold at a different resolved price (different weight,
      // different per-line discount). `.find()` used to grab only the
      // first such row, so returning against any line but the first one
      // sold silently used that first line's price/qty for the refund
      // math and capped "remaining returnable" at just that one line's
      // qty instead of everything actually sold under this sku.
      const matchingLines = transaction.items.filter((i) => i.sku === reqItem.sku);
      if (matchingLines.length === 0) throw new InvalidReturnQtyError(reqItem.sku);

      // Check if product is marked non-returnable
      const invItem = await tx.inventoryItem.findUnique({ where: { sku: reqItem.sku } });
      if (invItem && !invItem.isReturnable && !params.allowNonReturnableOverride) {
        throw new NonReturnableItemError(reqItem.sku);
      }

      const totalSoldQty = matchingLines.reduce((sum, l) => sum + l.qty, 0);
      const alreadyReturned = priorReturnedBySku.get(reqItem.sku) ?? 0;
      const remainingReturnable = totalSoldQty - alreadyReturned;
      if (!Number.isSafeInteger(reqItem.qty) || reqItem.qty <= 0 || reqItem.qty > remainingReturnable) {
        throw new InvalidReturnQtyError(reqItem.sku);
      }

      // Consume the returned qty across the matching lines in the order
      // they were sold (oldest first), pro-rating a partial line the same
      // way — each unit refunds its own line's net-per-unit price rather
      // than assuming every unit of this sku sold at the same price.
      const priced = priceReturn(matchingLines, alreadyReturned, reqItem.qty);
      if (!params.confirmedTrackedUnits && priced.allocations.some(a => {
        const line = matchingLines[a.index];
        return line.batchNumber || (Array.isArray(line.serialNumbers) && line.serialNumbers.length > 0);
      })) throw new InvalidReturnInputError("Confirm that the returned batches and serial numbers match the units shown on the return form");
      refundAmount += priced.amount;
      priorReturnedBySku.set(reqItem.sku, alreadyReturned + reqItem.qty);
      const representativeUnitPrice = priced.amount / reqItem.qty;

      returnItemsData.push({ sku: reqItem.sku, qty: reqItem.qty, unitPrice: representativeUnitPrice });

      for (const allocation of priced.allocations) {
        await restoreSaleStock(tx, transaction.id, matchingLines[allocation.index], allocation.qty, allocation.offset, "sales_return");
      }
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
      if (!Number.isSafeInteger(exItem.qty) || exItem.qty <= 0) throw new InvalidReturnInputError("Exchange quantity must be a positive whole number");
      const item = await tx.inventoryItem.findUnique({ where: { sku: exItem.sku } });
      if (!item) throw new UnknownExchangeSkuError(exItem.sku);
      if (item.isScaleItem) throw new InvalidReturnInputError("Process weighed replacement items through POS checkout after recording the return");
      if (item.trackBatch && !exItem.batchNumber) throw new InvalidReturnInputError(`Select a replacement batch for ${item.name}`);
      const batch = exItem.batchNumber ? await tx.itemBatch.findUnique({ where: { sku_batchNumber: { sku: exItem.sku, batchNumber: exItem.batchNumber } } }) : null;
      if (exItem.batchNumber && !batch) throw new InvalidReturnInputError(`Unknown replacement batch for ${item.name}`);
      if (item.trackSerial && (exItem.serialNumbers?.length !== exItem.qty || new Set(exItem.serialNumbers).size !== exItem.qty)) {
        throw new InvalidReturnInputError(`Enter one unique replacement serial per unit of ${item.name}`);
      }

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
      if (item.trackBatch || exItem.batchNumber) await deductBatchStock(tx, exItem.sku, exItem.qty, exItem.batchNumber);
      if (exItem.serialNumbers?.length) await validateAndAssignSerials(tx, exItem.sku, exItem.serialNumbers, transaction.id);

      const unitPrice = Number(batch?.unitPrice ?? item.unitPrice);
      exchangeTotal += unitPrice * exItem.qty;
      exchangeItemsData.push({ sku: exItem.sku, qty: exItem.qty, unitPrice });
    }

    exchangeTotal = Math.round(exchangeTotal * 100) / 100;
    const netAmount = Math.round((exchangeTotal - refundAmount) * 100) / 100;

    const salesReturn = await tx.salesReturn.create({
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

    // Persist replacement tracking details without rewriting the original receipt.
    if (exchangeItems.length) await tx.auditLog.create({ data: {
      entityType: "sales_return_exchange", entityId: salesReturn.id, actorId: params.createdById,
      reason: params.reason, newValue: { items: exchangeItems },
    } });

    // Issue the actual credit note when refundMethod is "store_credit" —
    // this used to be just a label on the return with nothing behind it
    // (see lib/customers/storeCredit.ts's docs). Scoped to plain,
    // non-exchange returns: an exchange's payout channel is
    // netPaymentMethod (cash/card/wallet only — the UI never offers
    // "store_credit" there), not refundMethod, so exchangeItemsData is
    // never combined with a store-credit payout here.
    if (exchangeItemsData.length === 0 && params.refundMethod === "store_credit" && refundAmount > 0) {
      await issueStoreCredit(tx, {
        customerId: transaction.customerId!,
        amount: refundAmount,
        reason: `Sales return: ${params.reason}`,
        sourceReturnId: salesReturn.id,
        createdById: params.createdById,
      });
    }

    return salesReturn;
  }, TRANSACTION_OPTIONS);
}

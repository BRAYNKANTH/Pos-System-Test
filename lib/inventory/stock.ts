import type { Prisma } from "@prisma/client";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { creditDefaultLocation, debitDefaultLocationBestEffort } from "@/lib/inventory/locationStock";

export class InsufficientStockError extends Error {
  constructor(public sku: string) {
    super(`Insufficient stock for ${sku}`);
  }
}

/** Race-condition-safe stock deduction — called from checkout inside its
 * own `$transaction` (pass `tx`). Uses a conditional
 * `updateMany` (`WHERE sku = ? AND qtyOnHand >= ?`) instead of read-then-
 * write, so two concurrent sales of the last unit can't both succeed.
 *
 * Deliberately does NOT also sync LocationStock here (it used to, inline)
 * — that's 3 extra round trips per line item, every one of them inside
 * the customer-facing checkout transaction, on a connection where each
 * round trip costs ~2-3s. LocationStock is explicitly best-effort
 * bookkeeping (see debitDefaultLocationBestEffort's own docs), so
 * checkout now fires `syncLocationStockAfterSale` for each line AFTER
 * the transaction commits and the customer already has their receipt,
 * without blocking the response on it. */
export async function deductStockOnSale(
  tx: Prisma.TransactionClient,
  sku: string,
  qty: number,
) {
  const result = await tx.inventoryItem.updateMany({
    where: { sku, qtyOnHand: { gte: qty } },
    data: { qtyOnHand: { decrement: qty } },
  });
  if (result.count === 0) {
    throw new InsufficientStockError(sku);
  }

  await tx.stockAdjustment.create({
    data: {
      sku,
      qtyChange: -qty,
      type: "automated",
      reasonCategory: "sale",
      status: "applied",
    },
  });
}

/** Post-transaction, fire-and-forget LocationStock sync for a completed
 * sale — see the note on deductStockOnSale above for why this isn't
 * awaited inside the checkout critical path anymore. Errors are logged,
 * never thrown — the sale itself already succeeded and must not be
 * undone by a bookkeeping failure. */
export function syncLocationStockAfterSale(sku: string, qty: number): void {
  prisma
    .$transaction(async (tx) => {
      await debitDefaultLocationBestEffort(tx, sku, qty);
    }, TRANSACTION_OPTIONS)
    .catch((err) => {
      console.error(`[stock] post-sale LocationStock sync failed for ${sku}:`, err);
    });
}

/** Automated increase from purchase orders / goods receipt. Not
 * threshold-checked — receiving stock isn't a "sudden/large" risk the way
 * depleting it or a manual write-off is. */
export async function increaseStockOnReceipt(sku: string, qty: number) {
  return prisma.$transaction(async (tx) => {
    const result = await tx.inventoryItem.updateMany({
      where: { sku },
      data: { qtyOnHand: { increment: qty } },
    });
    if (result.count === 0) {
      throw new Error(`Unknown SKU: ${sku}`);
    }

    await tx.stockAdjustment.create({
      data: {
        sku,
        qtyChange: qty,
        type: "automated",
        reasonCategory: "goods_receipt",
        status: "applied",
      },
    });

    await creditDefaultLocation(tx, sku, qty);
  }, TRANSACTION_OPTIONS);
}

function isOverThreshold(
  qtyChange: number,
  currentQty: number,
  threshold: { thresholdType: string; value: Prisma.Decimal },
): boolean {
  const absChange = Math.abs(qtyChange);
  if (threshold.thresholdType === "percent") {
    if (currentQty <= 0) return absChange > 0;
    return (absChange / currentQty) * 100 > Number(threshold.value);
  }
  return absChange > Number(threshold.value);
}

export class UnknownSkuError extends Error {
  constructor(public sku: string) {
    super(`Unknown SKU: ${sku}`);
  }
}

/** submitManualAdjustment — staff submits stock take/damage/spoilage/
 * correction. checkThreshold + holdForApproval are folded in here: if the
 * change is over the configured ApprovalThreshold, it's held pending
 * (qtyOnHand untouched) instead of applied immediately. */
export async function submitManualAdjustment(params: {
  sku: string;
  qtyChange: number;
  reasonCategory: string;
  requestedBy: string;
}) {
  const item = await prisma.inventoryItem.findUnique({ where: { sku: params.sku } });
  if (!item) throw new UnknownSkuError(params.sku);

  const threshold = await prisma.approvalThreshold.findFirst({ where: { scope: "default" } });
  const flagged = threshold
    ? isOverThreshold(params.qtyChange, item.qtyOnHand, threshold)
    : false;

  if (flagged) {
    const adjustment = await prisma.stockAdjustment.create({
      data: {
        sku: params.sku,
        qtyChange: params.qtyChange,
        type: "manual",
        reasonCategory: params.reasonCategory,
        status: "pending",
        thresholdFlagged: true,
        requestedBy: params.requestedBy,
      },
    });
    return { status: "pending" as const, adjustment };
  }

  return prisma.$transaction(async (tx) => {
    if (params.qtyChange < 0) {
      const result = await tx.inventoryItem.updateMany({
        where: { sku: params.sku, qtyOnHand: { gte: -params.qtyChange } },
        data: { qtyOnHand: { decrement: -params.qtyChange } },
      });
      if (result.count === 0) throw new InsufficientStockError(params.sku);
      await debitDefaultLocationBestEffort(tx, params.sku, -params.qtyChange);
    } else {
      await tx.inventoryItem.update({
        where: { sku: params.sku },
        data: { qtyOnHand: { increment: params.qtyChange } },
      });
      await creditDefaultLocation(tx, params.sku, params.qtyChange);
    }

    const adjustment = await tx.stockAdjustment.create({
      data: {
        sku: params.sku,
        qtyChange: params.qtyChange,
        type: "manual",
        reasonCategory: params.reasonCategory,
        status: "applied",
        thresholdFlagged: false,
        requestedBy: params.requestedBy,
      },
    });
    return { status: "applied" as const, adjustment };
  }, TRANSACTION_OPTIONS);
}

export class AdjustmentNotPendingError extends Error {
  constructor() {
    super("Adjustment is not pending");
  }
}

/** approveAdjustment — admin approves a held adjustment: applies the
 * change (still race-safe for decreases) and writes an audit log entry. */
export async function approveAdjustment(adjustmentId: string, approverId: string) {
  return prisma.$transaction(async (tx) => {
    const adjustment = await tx.stockAdjustment.findUnique({ where: { id: adjustmentId } });
    if (!adjustment) throw new Error("Adjustment not found");
    if (adjustment.status !== "pending") throw new AdjustmentNotPendingError();

    const item = await tx.inventoryItem.findUnique({ where: { sku: adjustment.sku } });
    if (!item) throw new UnknownSkuError(adjustment.sku);
    const before = item.qtyOnHand;

    if (adjustment.qtyChange < 0) {
      const result = await tx.inventoryItem.updateMany({
        where: { sku: adjustment.sku, qtyOnHand: { gte: -adjustment.qtyChange } },
        data: { qtyOnHand: { decrement: -adjustment.qtyChange } },
      });
      if (result.count === 0) throw new InsufficientStockError(adjustment.sku);
      await debitDefaultLocationBestEffort(tx, adjustment.sku, -adjustment.qtyChange);
    } else {
      await tx.inventoryItem.update({
        where: { sku: adjustment.sku },
        data: { qtyOnHand: { increment: adjustment.qtyChange } },
      });
      await creditDefaultLocation(tx, adjustment.sku, adjustment.qtyChange);
    }

    const updated = await tx.stockAdjustment.update({
      where: { id: adjustmentId },
      data: { status: "applied", approvedBy: approverId },
    });

    await writeAuditLog(
      {
        entityType: "stock_adjustment",
        entityId: adjustment.id,
        oldValue: { qtyOnHand: before },
        newValue: { qtyOnHand: before + adjustment.qtyChange },
        actorId: adjustment.requestedBy ?? approverId,
        approverId,
        reason: `Approved manual adjustment (${adjustment.reasonCategory ?? "unspecified"})`,
      },
      tx,
    );

    return updated;
  }, TRANSACTION_OPTIONS);
}

/** rejectAdjustment — admin rejects with a logged reason; qtyOnHand is
 * never touched. */
export async function rejectAdjustment(adjustmentId: string, approverId: string, reason: string) {
  const adjustment = await prisma.stockAdjustment.findUnique({ where: { id: adjustmentId } });
  if (!adjustment) throw new Error("Adjustment not found");
  if (adjustment.status !== "pending") throw new AdjustmentNotPendingError();

  const updated = await prisma.stockAdjustment.update({
    where: { id: adjustmentId },
    data: { status: "rejected", approvedBy: approverId },
  });

  await writeAuditLog({
    entityType: "stock_adjustment",
    entityId: adjustment.id,
    actorId: adjustment.requestedBy ?? approverId,
    approverId,
    reason,
  });

  return updated;
}

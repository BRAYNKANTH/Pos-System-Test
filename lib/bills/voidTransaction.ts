import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { creditDefaultLocation } from "@/lib/inventory/locationStock";

export class TransactionNotFoundError extends Error {
  constructor() {
    super("Transaction not found");
  }
}

export class AlreadyVoidedError extends Error {
  constructor() {
    super("Transaction is already voided");
  }
}

/** Quick void — a fast path for an admin to void a completed sale
 * directly, distinct from the full BillChangeRequest submit → pending →
 * separate-approver-approves workflow (still "administrator-controlled"
 * since it requires the same password re-auth as every other approval
 * action — see /api/pos/void/[id]/route.ts). Restores stock for every
 * line item, same as the request-based void path (see
 * approveChangeRequest in lib/bills/changeRequests.ts). */
export async function voidTransaction(transactionId: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.findUnique({
      where: { id: transactionId },
      include: { items: true, bill: true },
    });
    if (!transaction) throw new TransactionNotFoundError();
    if (transaction.status === "voided") throw new AlreadyVoidedError();

    for (const item of transaction.items) {
      await tx.inventoryItem.update({
        where: { sku: item.sku },
        data: { qtyOnHand: { increment: item.qty } },
      });
      await tx.stockAdjustment.create({
        data: {
          sku: item.sku,
          qtyChange: item.qty,
          type: "automated",
          reasonCategory: "sale_void",
          status: "applied",
        },
      });
      await creditDefaultLocation(tx, item.sku, item.qty);
    }

    const updatedTransaction = await tx.transaction.update({
      where: { id: transactionId },
      data: { status: "voided" },
    });

    if (transaction.bill) {
      await tx.bill.update({ where: { id: transaction.bill.id }, data: { status: "voided" } });
    }

    await writeAuditLog(
      {
        entityType: "transaction",
        entityId: transactionId,
        oldValue: { status: transaction.status },
        newValue: { status: "voided" },
        actorId,
        approverId: actorId,
        reason: "Quick void",
      },
      tx,
    );

    return updatedTransaction;
  }, TRANSACTION_OPTIONS);
}

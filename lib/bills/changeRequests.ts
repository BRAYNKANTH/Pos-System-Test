import type { Prisma } from "@prisma/client";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { creditDefaultLocation } from "@/lib/inventory/locationStock";

export class BillNotFoundError extends Error {
  constructor() {
    super("Bill not found");
  }
}

export class ChangeRequestNotPendingError extends Error {
  constructor() {
    super("Change request is not pending");
  }
}

export type ChangeRequestType = "correction" | "refund" | "void";

/** submitChangeRequest — cashier/manager submits a correction/refund/void
 * request against a locked bill. Doesn't touch the bill or transaction —
 * only admin approval does that (see approveChangeRequest). */
export async function submitChangeRequest(params: {
  billId: string;
  requestedBy: string;
  type: ChangeRequestType;
  reason: string;
  proposedChanges: unknown;
}) {
  const bill = await prisma.bill.findUnique({ where: { id: params.billId } });
  if (!bill) throw new BillNotFoundError();

  return prisma.billChangeRequest.create({
    data: {
      billId: params.billId,
      requestedBy: params.requestedBy,
      type: params.type,
      reason: params.reason,
      proposedChanges: params.proposedChanges as Prisma.InputJsonValue,
      status: "pending",
    },
  });
}

/** approveChangeRequest — admin approves. Per the "never overwrites
 * original" rule, the original Transaction row is never mutated — the
 * approved change becomes an audit-logged, Zoho-synced adjustment
 * (credit note) layered on top:
 *   - "void"      → bill + transaction marked voided, stock restored for
 *                   every line (same as Quick Void)
 *   - "refund"    → bill marked refunded
 *   - "correction"→ bill stays locked; the correction is the audit trail
 *                   + linked Zoho credit note, not a rewrite of the sale
 */
export async function approveChangeRequest(requestId: string, approverId: string) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.billChangeRequest.findUnique({
      where: { id: requestId },
      include: { bill: { include: { transaction: { include: { items: true } } } } },
    });
    if (!request) throw new Error("Change request not found");
    if (request.status !== "pending") throw new ChangeRequestNotPendingError();

    const oldValue = {
      billStatus: request.bill.status,
      transactionStatus: request.bill.transaction.status,
    };

    if (request.type === "void") {
      await tx.bill.update({ where: { id: request.billId }, data: { status: "voided" } });
      await tx.transaction.update({
        where: { id: request.bill.transactionId },
        data: { status: "voided" },
      });

      // Restore stock for every line, matching Quick Void's behavior — a
      // void is a void regardless of which approval path it took.
      if (request.bill.transaction.status !== "voided") {
        for (const item of request.bill.transaction.items) {
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
      }
    } else if (request.type === "refund") {
      await tx.bill.update({ where: { id: request.billId }, data: { status: "refunded" } });
    }
    // "correction" intentionally leaves bill/transaction untouched.

    const updated = await tx.billChangeRequest.update({
      where: { id: requestId },
      data: { status: "approved", approvedBy: approverId, approvedAt: new Date() },
    });

    await writeAuditLog(
      {
        entityType: "bill_change_request",
        entityId: request.id,
        oldValue,
        newValue: { type: request.type, proposedChanges: request.proposedChanges },
        actorId: request.requestedBy,
        approverId,
        reason: request.reason,
      },
      tx,
    );

    return updated;
  }, TRANSACTION_OPTIONS);
}

/** rejectChangeRequest — admin rejects with a logged reason; bill/
 * transaction are never touched. */
export async function rejectChangeRequest(requestId: string, approverId: string, reason: string) {
  const request = await prisma.billChangeRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new Error("Change request not found");
  if (request.status !== "pending") throw new ChangeRequestNotPendingError();

  const updated = await prisma.billChangeRequest.update({
    where: { id: requestId },
    data: { status: "rejected", approvedBy: approverId, approvedAt: new Date() },
  });

  await writeAuditLog({
    entityType: "bill_change_request",
    entityId: request.id,
    actorId: request.requestedBy,
    approverId,
    reason,
  });

  return updated;
}

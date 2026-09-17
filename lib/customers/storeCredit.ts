import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/** Called once by the locked sale-void operation. Original redemptions remain
 * auditable; a replacement note also works when the original note was cancelled. */
export async function restoreVoidedStoreCredit(tx: Prisma.TransactionClient, transactionId: string, actorId: string) {
  const redemptions = await tx.storeCreditRedemption.findMany({
    where: { transactionId }, include: { storeCredit: { select: { customerId: true } } },
  });
  const byCustomer = new Map<string, number>();
  for (const redemption of redemptions) {
    const customerId = redemption.storeCredit.customerId;
    byCustomer.set(customerId, (byCustomer.get(customerId) ?? 0) + Number(redemption.amount));
  }
  for (const [customerId, amount] of byCustomer) {
    await issueStoreCredit(tx, { customerId, amount: Math.round(amount * 100) / 100,
      reason: `Store credit restored after voiding sale ${transactionId}`, createdById: actorId });
  }
}

export class InsufficientStoreCreditError extends Error {
  constructor(public customerId: string) {
    super("Customer's available store credit balance is less than the amount requested");
  }
}

/** Sum of `remainingAmount` across a customer's active credit notes — the
 * balance they can actually spend at checkout. Used both to show the
 * balance in the UI (POS payment modal, customer detail page) and, inside
 * a transaction, to validate a redemption before it's applied. */
export async function getAvailableStoreCredit(customerId: string): Promise<number> {
  const active = await prisma.storeCredit.findMany({
    where: { customerId, status: "active" },
    select: { remainingAmount: true },
  });
  return Math.round(active.reduce((sum, c) => sum + Number(c.remainingAmount), 0) * 100) / 100;
}

/** Issue a new credit note for a customer — either as the outcome of a
 * sales return (`sourceReturnId` set, called from
 * lib/sales/returns.ts inside its own transaction) or manually from the
 * customer's detail page (no source return). */
export async function issueStoreCredit(
  tx: Prisma.TransactionClient,
  params: {
    customerId: string;
    amount: number;
    reason?: string;
    sourceReturnId?: string;
    createdById?: string;
  },
) {
  return tx.storeCredit.create({
    data: {
      customerId: params.customerId,
      amount: params.amount,
      remainingAmount: params.amount,
      reason: params.reason,
      sourceReturnId: params.sourceReturnId,
      createdById: params.createdById,
    },
  });
}

/** Redeem `amount` of a customer's store credit against `transactionId` —
 * drawn down oldest-credit-note-first (FIFO, same ordering convention as
 * lib/inventory/batches.ts's expiry-FIFO), recording one
 * StoreCreditRedemption row per credit note it actually touches so the
 * ledger stays auditable. Re-checks each row's live `remainingAmount`
 * inside `tx` rather than trusting a balance read before the transaction
 * started, so two concurrent checkouts for the same customer can't both
 * spend the same rupee — throws InsufficientStoreCreditError and rolls
 * back the whole sale if the live balance turns out to be short. */
export async function redeemStoreCredit(
  tx: Prisma.TransactionClient,
  customerId: string,
  amount: number,
  transactionId: string,
) {
  if (amount <= 0) return;

  const activeCredits = await tx.storeCredit.findMany({
    where: { customerId, status: "active" },
    orderBy: { createdAt: "asc" },
  });

  let remainingToRedeem = Math.round(amount * 100) / 100;
  for (const credit of activeCredits) {
    if (remainingToRedeem <= 0) break;
    const available = Number(credit.remainingAmount);
    if (available <= 0) continue;
    const redeemFromThis = Math.min(available, remainingToRedeem);
    const newRemaining = Math.round((available - redeemFromThis) * 100) / 100;

    const updated = await tx.storeCredit.updateMany({
      where: { id: credit.id, status: "active", remainingAmount: credit.remainingAmount },
      data: { remainingAmount: newRemaining, status: newRemaining <= 0 ? "used" : "active" },
    });
    if (updated.count !== 1) throw new InsufficientStoreCreditError(customerId);
    await tx.storeCreditRedemption.create({
      data: { storeCreditId: credit.id, transactionId, amount: redeemFromThis },
    });
    remainingToRedeem = Math.round((remainingToRedeem - redeemFromThis) * 100) / 100;
  }

  if (remainingToRedeem > 0) {
    throw new InsufficientStoreCreditError(customerId);
  }
}

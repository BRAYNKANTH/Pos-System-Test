import type { Prisma } from "@prisma/client";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { restoreSaleStock } from "@/lib/inventory/restoreSaleStock";
import { restoreVoidedStoreCredit } from "@/lib/customers/storeCredit";

export class TransactionNotFoundError extends Error {
  constructor() { super("Transaction not found"); }
}
export class AlreadyVoidedError extends Error {
  constructor() { super("Transaction is already voided"); }
}
export class SaleCannotBeVoidedError extends Error {}

export async function voidTransactionInTx(tx: Prisma.TransactionClient, transactionId: string, actorId: string, reason: string) {
  // pg_advisory_xact_lock returns void — $queryRaw fails trying to
  // deserialize a void-typed result column, which broke every void.
  // $executeRaw doesn't read back rows, so it's the correct call here:
  // only the lock's side effect matters, never its return value.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${transactionId}))`;
  const transaction = await tx.transaction.findUnique({ where: { id: transactionId }, include: { items: true, bill: true } });
  if (!transaction) throw new TransactionNotFoundError();
  if (transaction.status === "voided") throw new AlreadyVoidedError();
  if (transaction.status !== "completed" || transaction.bill?.status === "refunded") {
    throw new SaleCannotBeVoidedError("Only a completed, unrefunded sale can be voided");
  }
  if (await tx.salesReturn.findFirst({ where: { transactionId }, select: { id: true } })) {
    throw new SaleCannotBeVoidedError("This sale already has a return or exchange. Return any remaining items instead of voiding the full sale.");
  }
  for (const item of transaction.items) await restoreSaleStock(tx, transactionId, item, item.qty, 0, "sale_void");
  await restoreVoidedStoreCredit(tx, transactionId, actorId);
  const updated = await tx.transaction.update({ where: { id: transactionId }, data: { status: "voided" } });
  if (transaction.bill) await tx.bill.update({ where: { id: transaction.bill.id }, data: { status: "voided" } });
  await writeAuditLog({ entityType: "transaction", entityId: transactionId,
    oldValue: { status: transaction.status }, newValue: { status: "voided" },
    actorId, approverId: actorId, reason }, tx);
  return { ...updated, billId: transaction.bill?.id ?? null };
}

export async function voidTransaction(transactionId: string, actorId: string) {
  return prisma.$transaction(tx => voidTransactionInTx(tx, transactionId, actorId, "Quick void"), TRANSACTION_OPTIONS);
}

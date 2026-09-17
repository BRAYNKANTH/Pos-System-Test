import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { deductStockOnSale, InsufficientStockError } from "@/lib/inventory/stock";

export class TransactionNotFoundError extends Error {
  constructor() {
    super("Transaction not found");
  }
}

export class InvoiceNotEditableError extends Error {
  constructor(status: string) {
    super(`Only a completed sale can be edited — this one is "${status}"`);
  }
}

export class TrackedLineNotEditableError extends Error {
  constructor(public sku: string) {
    super(`${sku} is batch/serial-tracked — edit it via a sales return + fresh sale instead, so the batch/serial ledger stays correct`);
  }
}

export class LineNotFoundError extends Error {
  constructor() {
    super("One of the line items to edit isn't on this invoice");
  }
}

/** editInvoiceLines — Admin-only direct correction of a locked, already
 * completed invoice: change a line's quantity/price/discount, or drop a
 * line entirely. Distinct from both a sales return (customer physically
 * brings something back) and a void (cancels the whole sale) — this is
 * for fixing a data-entry mistake on the invoice itself, restricted to
 * ADMIN and gated by elevated re-auth at the route layer (see
 * app/api/bills/[id]/route.ts) since it rewrites a financial record after
 * the fact. Scoped to non-batch/non-serial lines only — those need the
 * return+resell path so the batch/serial ledger doesn't drift out of
 * sync with an edit that bypasses it. Adding a brand-new SKU to an
 * existing invoice isn't supported — process that as a new sale. */
export async function editInvoiceLines(params: {
  transactionId: string;
  updates: { id: string; qty: number; unitPrice: number; discount: number }[];
  removeIds: string[];
  actorId: string;
  reason: string;
}) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${params.transactionId}))`;
    const transaction = await tx.transaction.findUnique({
      where: { id: params.transactionId },
      include: { items: true },
    });
    if (!transaction) throw new TransactionNotFoundError();
    if (transaction.status !== "completed") throw new InvoiceNotEditableError(transaction.status);

    const itemsById = new Map(transaction.items.map((i) => [i.id, i]));
    const oldValue = {
      items: transaction.items.map((i) => ({ sku: i.sku, qty: i.qty, unitPrice: Number(i.unitPrice), discount: Number(i.discount) })),
      subtotal: Number(transaction.subtotal),
      tax: Number(transaction.tax),
      total: Number(transaction.total),
    };

    function assertEditable(line: { sku: string; batchNumber: string | null; serialNumbers: unknown }) {
      const hasSerials = Array.isArray(line.serialNumbers) && line.serialNumbers.length > 0;
      if (line.batchNumber || hasSerials) throw new TrackedLineNotEditableError(line.sku);
    }

    // Remove lines first — restock what they held, then delete the row.
    for (const id of params.removeIds) {
      const line = itemsById.get(id);
      if (!line) throw new LineNotFoundError();
      assertEditable(line);
      await tx.inventoryItem.update({ where: { sku: line.sku }, data: { qtyOnHand: { increment: line.qty } } });
      await tx.stockAdjustment.create({
        data: { sku: line.sku, qtyChange: line.qty, type: "automated", reasonCategory: "invoice_edit", status: "applied" },
      });
      await tx.transactionItem.delete({ where: { id } });
      itemsById.delete(id);
    }

    // Update the rest — adjust stock by the qty delta, and rescale this
    // line's tax by whatever rate it was originally charged (its own
    // taxAmount / lineSubtotal), rather than re-resolving today's tax
    // rules — an edit is a correction to what was actually charged, not
    // a chance for tax policy to silently change on an old invoice.
    for (const u of params.updates) {
      const line = itemsById.get(u.id);
      if (!line) throw new LineNotFoundError();
      assertEditable(line);
      if (!Number.isSafeInteger(u.qty) || u.qty <= 0) throw new Error(`Quantity for ${line.sku} must be a positive whole number`);
      if (!Number.isFinite(u.unitPrice) || u.unitPrice < 0) throw new Error(`Unit price for ${line.sku} is invalid`);
      if (!Number.isFinite(u.discount) || u.discount < 0) throw new Error(`Discount for ${line.sku} is invalid`);

      const qtyDelta = u.qty - line.qty;
      if (qtyDelta > 0) {
        try {
          await deductStockOnSale(tx, line.sku, qtyDelta);
        } catch (err) {
          if (err instanceof InsufficientStockError) throw err;
          throw err;
        }
      } else if (qtyDelta < 0) {
        await tx.inventoryItem.update({ where: { sku: line.sku }, data: { qtyOnHand: { increment: -qtyDelta } } });
        await tx.stockAdjustment.create({
          data: { sku: line.sku, qtyChange: -qtyDelta, type: "automated", reasonCategory: "invoice_edit", status: "applied" },
        });
      }

      const originalLineSubtotal = Number(line.unitPrice) * line.qty - Number(line.discount);
      const originalTaxRate = originalLineSubtotal > 0 ? Number(line.taxAmount) / originalLineSubtotal : 0;
      const newLineSubtotal = Math.max(0, u.unitPrice * u.qty - u.discount);
      const newTaxAmount = Math.round(newLineSubtotal * originalTaxRate * 100) / 100;

      await tx.transactionItem.update({
        where: { id: u.id },
        data: { qty: u.qty, unitPrice: u.unitPrice, discount: u.discount, taxAmount: newTaxAmount },
      });
    }

    const remaining = await tx.transactionItem.findMany({ where: { transactionId: params.transactionId } });
    if (remaining.length === 0) throw new Error("An invoice can't be edited down to zero line items — void the sale instead");

    const subtotal = Math.round(remaining.reduce((sum, i) => sum + Number(i.unitPrice) * i.qty, 0) * 100) / 100;
    const totalDiscount = Math.round(remaining.reduce((sum, i) => sum + Number(i.discount), 0) * 100) / 100;
    const tax = Math.round(remaining.reduce((sum, i) => sum + Number(i.taxAmount), 0) * 100) / 100;
    const total = Math.round((subtotal - totalDiscount + tax + Number(transaction.shipping)) * 100) / 100;

    const updated = await tx.transaction.update({
      where: { id: params.transactionId },
      data: { subtotal, tax, total },
      include: { items: true },
    });

    await writeAuditLog(
      {
        entityType: "invoice_edit",
        entityId: params.transactionId,
        oldValue,
        newValue: {
          items: updated.items.map((i) => ({ sku: i.sku, qty: i.qty, unitPrice: Number(i.unitPrice), discount: Number(i.discount) })),
          subtotal,
          tax,
          total,
        },
        actorId: params.actorId,
        reason: params.reason,
      },
      tx,
    );

    return updated;
  }, TRANSACTION_OPTIONS);
}

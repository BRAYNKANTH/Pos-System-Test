import { prisma } from "@/lib/prisma";

export class QuotationNotFoundError extends Error {
  constructor() {
    super("Quotation not found");
  }
}

export class QuotationNotConvertibleError extends Error {
  constructor() {
    super("Only draft or sent quotations can be converted");
  }
}

/** A quotation has zero stock/ledger impact — it's just a saved price
 * estimate. Converting it doesn't create a Transaction directly (that
 * still goes through the real checkout flow, including stock deduction
 * and payment) — it hands the items back to the caller (see
 * app/api/sales/quotations/[id]/convert) to load into the POS cart. */
export async function createQuotation(params: {
  customerId: string | null;
  items: { sku: string; name: string; qty: number; unitPrice: number }[];
  discount: number;
  validUntil: Date | null;
  createdById: string;
}) {
  const subtotal = params.items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0);
  const total = Math.max(0, subtotal - params.discount);

  return prisma.quotation.create({
    data: {
      referenceNo: `QT-${Date.now()}`,
      customerId: params.customerId,
      validUntil: params.validUntil,
      subtotal,
      discount: params.discount,
      total,
      createdById: params.createdById,
      items: { create: params.items.map((i) => ({ sku: i.sku, name: i.name, qty: i.qty, unitPrice: i.unitPrice })) },
    },
    include: { items: true, customer: true },
  });
}

export async function convertQuotation(id: string) {
  const quotation = await prisma.quotation.findUnique({ where: { id }, include: { items: true, customer: true } });
  if (!quotation) throw new QuotationNotFoundError();
  if (quotation.status !== "draft" && quotation.status !== "sent") throw new QuotationNotConvertibleError();

  await prisma.quotation.update({ where: { id }, data: { status: "converted" } });
  return quotation;
}

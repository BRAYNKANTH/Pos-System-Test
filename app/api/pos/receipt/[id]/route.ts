import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { apiSuccess, apiError } from "@/lib/api-response";

// generateReceipt — GET /api/pos/receipt/:id
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });

  const { id } = await params;
  const [transaction, invoiceSettings, businessSettings, defaultLocation] = await Promise.all([
    prisma.transaction.findUnique({
      where: { id },
      include: { items: true, cashier: true, bill: true, tenders: true, customer: true },
    }),
    prisma.invoiceSettings.findUnique({ where: { id: "default" } }),
    prisma.businessSettings.findUnique({ where: { id: "default" } }),
    (async () =>
      (await prisma.location.findFirst({ where: { isDefault: true } })) ??
      (await prisma.location.findFirst()))(),
  ]);
  if (!transaction) return apiError("NOT_FOUND", "Transaction not found", { status: 404 });

  type InvoiceLayout = {
    isDefault?: boolean;
    invoiceHeading?: string;
    showLetterHead?: boolean;
    letterHeadImage?: string | null;
  };
  const invData = (invoiceSettings?.data as { layouts?: InvoiceLayout[] } | null) ?? {};
  const defaultLayout = Array.isArray(invData.layouts)
    ? invData.layouts.find((l) => l.isDefault)
    : null;
  const headingText = defaultLayout?.invoiceHeading || "Sales Receipt";
  const letterHeadImage = defaultLayout?.showLetterHead ? (defaultLayout?.letterHeadImage ?? null) : null;

  const bizData = (businessSettings?.data as { bizName?: string; tax1No?: string; tax2No?: string } | null) ?? {};
  const bizName = bizData.bizName || defaultLocation?.name || "";
  const taxNo = bizData.tax1No || bizData.tax2No || null;

  return apiSuccess({
    id: transaction.id,
    headingText,
    letterHeadImage,
    bizName,
    locationName: defaultLocation?.name ?? null,
    taxNo,
    createdAt: transaction.createdAt,
    cashierName: transaction.cashier.name,
    customerName: transaction.customer?.name ?? null,
    registerId: transaction.registerId,
    paymentMethod: transaction.paymentMethod,
    status: transaction.status,
    subtotal: Number(transaction.subtotal),
    tax: Number(transaction.tax),
    shipping: Number(transaction.shipping),
    total: Number(transaction.total),
    billId: transaction.bill?.id ?? null,
    billStatus: transaction.bill?.status ?? null,
    tenders: transaction.tenders.map((t) => ({ method: t.method, amount: Number(t.amount) })),
    items: transaction.items.map((item) => ({
      sku: item.sku,
      qty: item.qty,
      unitPrice: Number(item.unitPrice),
      discount: Number(item.discount),
      taxAmount: Number(item.taxAmount),
    })),
  });
}

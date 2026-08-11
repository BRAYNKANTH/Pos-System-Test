import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { apiSuccess, apiError } from "@/lib/api-response";

// generateReceipt — GET /api/pos/receipt/:id
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });

  const { id } = await params;
  const [transaction, invoiceSettings] = await Promise.all([
    prisma.transaction.findUnique({
      where: { id },
      include: { items: true, cashier: true, bill: true, tenders: true, customer: true },
    }),
    prisma.invoiceSettings.findUnique({ where: { id: "default" } }),
  ]);
  if (!transaction) return apiError("NOT_FOUND", "Transaction not found", { status: 404 });

  const invData = (invoiceSettings?.data as any) ?? {};
  const defaultLayout = Array.isArray(invData.layouts)
    ? invData.layouts.find((l: any) => l.isDefault)
    : null;
  const headingText = defaultLayout?.invoiceHeading || "Sales Receipt";

  return apiSuccess({
    id: transaction.id,
    headingText,
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

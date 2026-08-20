import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { Badge } from "@/components/ui/badge";
import { VoidSaleButton } from "@/components/VoidSaleButton";
import { PrintButton } from "./_PrintButton";

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) notFound();

  const { id } = await params;
  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: { items: true, cashier: true, bill: true, tenders: true, customer: true },
  });
  if (!transaction) notFound();

  // Load settings and location details to fill in receipt header details.
  // The default-location fallback is wrapped in an async IIFE rather than
  // `queryA || queryB` — a Promise is always truthy, so `||` between two
  // unresolved promises always picks the first one and the fallback never
  // actually runs (a real, previously-undetected bug: if no location is
  // ever marked isDefault, this silently fell through to `null` instead
  // of using the second query).
  const [bizSettings, defaultLocation, invoiceSettings] = await Promise.all([
    prisma.businessSettings.findUnique({ where: { id: "default" } }),
    (async () =>
      (await prisma.location.findFirst({ where: { isDefault: true } })) ??
      (await prisma.location.findFirst()))(),
    prisma.invoiceSettings.findUnique({ where: { id: "default" } }),
  ]);

  const invData = (invoiceSettings?.data as any) ?? {};
  const defaultLayout = Array.isArray(invData.layouts)
    ? invData.layouts.find((l: any) => l.isDefault)
    : null;
  const headingText = defaultLayout?.invoiceHeading || "Sales Receipt";
  const letterHeadImage = defaultLayout?.showLetterHead ? (defaultLayout?.letterHeadImage ?? null) : null;

  const bizData = (bizSettings?.data as any) ?? {};
  const bizName = bizData.bizName ?? defaultLocation?.name ?? "";
  const taxNo = bizData.tax1No || bizData.tax2No || "";

  // Load product catalog to show full readable names on receipt rather than raw SKU codes
  const itemSkus = transaction.items.map((i) => i.sku);
  const products = await prisma.inventoryItem.findMany({
    where: { sku: { in: itemSkus } },
    select: { sku: true, name: true },
  });
  const nameMap = new Map(products.map((p) => [p.sku, p.name]));

  const canVoid =
    transaction.status === "completed" &&
    (await checkPermission(user.role, PERMISSIONS.BILLS_APPROVE));

  // Compute calculated amounts
  const totalPaid = transaction.tenders.reduce((sum, t) => sum + Number(t.amount), 0);
  const totalDue = Math.max(0, Number(transaction.total) - totalPaid);
  const changeDue = Math.max(0, totalPaid - Number(transaction.total));

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8 print:p-0 print:max-w-full">
      
      {/* ─── THERMAL RECEIPT SLIP WRAPPER ─── */}
      <div className="printable-receipt bg-white text-zinc-950 border border-zinc-200 p-6 rounded-md shadow-sm font-mono text-xs leading-relaxed dark:bg-white dark:text-zinc-950 select-none print:border-0 print:shadow-none">
        
        {/* Business Header */}
        <div className="text-center space-y-1 mb-4">
          {letterHeadImage && (
            // eslint-disable-next-line @next/next/no-img-element -- base64 data URL from settings, not a static/remote asset
            <img src={letterHeadImage} alt="Letter head" className="mx-auto max-h-20 w-auto object-contain mb-1" />
          )}
          <h1 className="text-base font-extrabold uppercase tracking-wide text-zinc-900">{bizName}</h1>
          
          {defaultLocation && (
            <p className="text-[10px] text-zinc-600">
              {defaultLocation.landmark && `${defaultLocation.landmark}, `}
              {defaultLocation.city && `${defaultLocation.city}`}
              {defaultLocation.country && ` (${defaultLocation.country})`}
            </p>
          )}
          
          {taxNo && <p className="text-[10px] text-zinc-600 font-bold">TAX ID: {taxNo}</p>}
          
          <div className="flex items-center justify-center gap-1.5 pt-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider bg-zinc-100 px-2 py-0.5 rounded text-zinc-800 border">
              {transaction.status === "voided" ? "Void Invoice" : headingText}
            </span>
          </div>
        </div>

        {/* Invoice Metadata Grid */}
        <div className="space-y-1 border-t border-dashed border-zinc-300 py-3 text-[10px] text-zinc-700">
          <div className="flex justify-between">
            <span>Invoice No:</span>
            <span className="font-bold font-sans text-zinc-900 uppercase">{transaction.id.slice(-8)}</span>
          </div>
          <div className="flex justify-between">
            <span>Date/Time:</span>
            <span>{transaction.createdAt.toLocaleDateString()} {transaction.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          <div className="flex justify-between">
            <span>Cashier:</span>
            <span>{transaction.cashier.name}</span>
          </div>
          <div className="flex justify-between">
            <span>Customer:</span>
            <span className="font-bold text-zinc-900">{transaction.customer?.name ?? "Walk-In Customer"}</span>
          </div>
          {transaction.customer?.phone && (
            <div className="flex justify-between">
              <span>Contact:</span>
              <span>{transaction.customer.phone}</span>
            </div>
          )}
        </div>

        {/* Items Table Headers */}
        <div className="border-t border-zinc-900 pt-2 pb-1 text-[9px] font-bold text-zinc-900 flex justify-between">
          <span className="flex-1">Item Description</span>
          <span className="w-8 text-center">Qty</span>
          <span className="w-14 text-right">Price</span>
          <span className="w-12 text-right">Disc</span>
          <span className="w-14 text-right">Total</span>
        </div>
        <div className="border-b border-zinc-400 mb-2"></div>

        {/* Items List Rows */}
        <div className="space-y-2 pb-3">
          {transaction.items.map((item) => {
            const displayName = nameMap.get(item.sku) ?? item.sku;
            const itemPrice = Number(item.unitPrice);
            const discount = Number(item.discount);
            const lineSubtotal = itemPrice * item.qty - discount;

            return (
              <div key={item.id} className="flex justify-between text-zinc-900 font-semibold text-[10px] leading-tight">
                <span className="flex-1 truncate pr-1" title={displayName}>{displayName}</span>
                <span className="w-8 text-center font-sans font-normal">{item.qty}</span>
                <span className="w-14 text-right font-sans font-normal">{itemPrice.toFixed(2)}</span>
                <span className="w-12 text-right font-sans font-normal text-red-650">
                  {discount > 0 ? `-${discount.toFixed(0)}` : "0.00"}
                </span>
                <span className="w-14 text-right font-sans">{lineSubtotal.toFixed(2)}</span>
              </div>
            );
          })}
        </div>

        {/* Totals Summary */}
        <div className="border-t border-dashed border-zinc-300 py-3 space-y-1.5 text-zinc-800 text-[11px]">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="font-sans">Rs {Number(transaction.subtotal).toFixed(2)}</span>
          </div>
          
          <div className="flex justify-between">
            <span>Tax (GST/VAT)</span>
            <span className="font-sans">Rs {Number(transaction.tax).toFixed(2)}</span>
          </div>

          {Number(transaction.shipping) > 0 && (
            <div className="flex justify-between">
              <span>Shipping Charge</span>
              <span className="font-sans">Rs {Number(transaction.shipping).toFixed(2)}</span>
            </div>
          )}

          {transaction.tenders.some(t => Number(t.amount) > 0) && (
            <div className="flex justify-between text-red-750">
              <span>Total Discount</span>
              <span className="font-sans">-Rs {transaction.items.reduce((sum, i) => sum + Number(i.discount), 0).toFixed(2)}</span>
            </div>
          )}

          <div className="flex justify-between text-zinc-900 font-extrabold text-sm border-t border-dashed border-zinc-300 pt-2.5">
            <span>NET PAYABLE</span>
            <span className="font-sans">Rs {Number(transaction.total).toFixed(2)}</span>
          </div>
        </div>

        {/* Payments breakdown */}
        <div className="border-t border-zinc-900 pt-2 pb-1.5 space-y-1 text-[10px] text-zinc-650">
          <p className="font-bold text-zinc-800 uppercase tracking-wide">Payment Details:</p>
          {transaction.tenders.map((t) => (
            <div key={t.id} className="flex justify-between">
              <span className="capitalize">{t.method} Pay:</span>
              <span className="font-sans">Rs {Number(t.amount).toFixed(2)}</span>
            </div>
          ))}
          <div className="flex justify-between pt-1 border-t border-zinc-150">
            <span>Tendered Amount:</span>
            <span className="font-sans">Rs {totalPaid.toFixed(2)}</span>
          </div>
          {changeDue > 0 && (
            <div className="flex justify-between font-bold text-zinc-900">
              <span>Change Paid Out:</span>
              <span className="font-sans">Rs {changeDue.toFixed(2)}</span>
            </div>
          )}
          {totalDue > 0 && (
            <div className="flex justify-between font-bold text-red-650">
              <span>Balance Amount Due:</span>
              <span className="font-sans">Rs {totalDue.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Receipt Footer Message */}
        <div className="border-t border-dashed border-zinc-300 pt-4 text-center space-y-1 text-[10px] text-zinc-600">
          <p className="font-bold">Thank you for shopping with us!</p>
          <p>Please come again.</p>
          <p className="text-[8px] text-zinc-400 font-sans pt-1">Powered by Cloud POS</p>
        </div>

      </div>

      {/* ─── ACTIONS DRAWER ─── */}
      <div className="flex flex-col gap-2 print:hidden">
        <PrintButton />
        
        {canVoid && (
          <div className="flex justify-center">
            <VoidSaleButton transactionId={transaction.id} />
          </div>
        )}
        
        {transaction.bill && (
          <Link
            href={`/bills/${transaction.bill.id}`}
            className="flex items-center justify-center h-10 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-sm font-semibold text-zinc-700 transition dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-300"
          >
            View Bill Status
          </Link>
        )}
        
        <Link 
          href="/pos" 
          className="flex items-center justify-center h-10 rounded-lg bg-indigo-650 hover:bg-indigo-750 text-sm font-semibold text-white transition"
        >
          New POS Sale
        </Link>
      </div>

    </main>
  );
}

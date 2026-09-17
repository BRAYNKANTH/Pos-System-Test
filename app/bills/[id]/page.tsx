import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { Badge } from "@/components/ui/badge";
import { VoidSaleButton } from "@/components/VoidSaleButton";
import { EditInvoiceButton } from "@/components/EditInvoiceButton";
import { Receipt, ArrowLeft, Lock, User, CreditCard } from "lucide-react";

export const dynamic = "force-dynamic";

const currencyFmt = (val: number) =>
  `Rs ${val.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function statusBadge(status: string) {
  const variant = status === "locked" ? "default" : status === "voided" ? "destructive" : "warning";
  return (
    <Badge variant={variant} className="capitalize">
      {status}
    </Badge>
  );
}

export default async function BillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;
  const bill = await prisma.bill.findUnique({
    where: { id },
    include: {
      transaction: { include: { items: true, cashier: true, customer: true } },
    },
  });
  if (!bill) notFound();

  const canVoid =
    bill.transaction.status === "completed" &&
    user &&
    (await checkPermission(user.role, PERMISSIONS.BILLS_APPROVE));
  const canEdit = bill.transaction.status === "completed" && user?.role === "ADMIN";

  return (
    <main className="p-6 space-y-6 max-w-4xl mx-auto">
      <Link
        href="/bills"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-indigo-650 transition"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Bills
      </Link>

      {/* Header Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-650">
              <Receipt className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-900 tracking-tight font-mono uppercase">
              {bill.id.slice(-8)}
            </h1>
            {statusBadge(bill.status)}
          </div>
          <p className="text-xs text-zinc-500 mt-1 pl-11 font-mono" title={bill.id}>
            {bill.id}
          </p>
        </div>

        {(canEdit || canVoid) && (
          <div className="flex items-center gap-2">
            {canEdit && (
              <EditInvoiceButton
                billId={bill.id}
                items={bill.transaction.items.map((i) => ({
                  id: i.id,
                  sku: i.sku,
                  qty: i.qty,
                  unitPrice: Number(i.unitPrice),
                  discount: Number(i.discount),
                  batchNumber: i.batchNumber,
                  serialNumbers: i.serialNumbers,
                }))}
              />
            )}
            {canVoid && <VoidSaleButton transactionId={bill.transaction.id} />}
          </div>
        )}
      </div>

      {/* Sale Meta Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-zinc-200/80 p-4 shadow-xs flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
            <User className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">Customer</span>
            <span className="text-sm font-bold text-zinc-800">{bill.transaction.customer?.name ?? "Walk-In"}</span>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-zinc-200/80 p-4 shadow-xs flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">Payment</span>
            <span className="text-sm font-bold text-zinc-800 capitalize">
              {bill.transaction.paymentMethod.replace("_", " ")}
            </span>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-zinc-200/80 p-4 shadow-xs flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center shrink-0">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">Locked</span>
            <span className="text-sm font-bold text-zinc-800">
              {bill.lockedAt.toLocaleDateString("en-GB").replace(/\//g, "-")}{" "}
              <span className="text-zinc-400 font-normal">
                {bill.lockedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Line Items Card */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-zinc-150 bg-zinc-50/50">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-600 flex items-center gap-2">
            <Receipt className="h-4 w-4 text-zinc-500" /> Line Items
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-50 text-zinc-650 font-bold border-b border-zinc-150 uppercase tracking-wider text-xs">
              <tr>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3 text-center">Qty</th>
                <th className="px-4 py-3 text-right">Unit Price</th>
                <th className="px-4 py-3 text-right">Discount</th>
                <th className="px-4 py-3 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200/70 text-sm">
              {bill.transaction.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-bold text-zinc-800">
                    {item.sku}
                    {item.batchNumber && <span className="text-zinc-400 font-normal"> ({item.batchNumber})</span>}
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-zinc-700">{item.qty}</td>
                  <td className="px-4 py-3 text-right font-mono text-zinc-700">
                    {currencyFmt(Number(item.unitPrice))}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-red-600">
                    {Number(item.discount) > 0 ? `-${currencyFmt(Number(item.discount))}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-zinc-900">
                    {currencyFmt(Number(item.unitPrice) * item.qty - Number(item.discount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-zinc-150 bg-zinc-50/50 flex flex-col items-end gap-1 text-sm">
          <div className="flex justify-between w-full max-w-[220px] text-zinc-600">
            <span>Subtotal</span>
            <span className="font-mono">{currencyFmt(Number(bill.transaction.subtotal))}</span>
          </div>
          <div className="flex justify-between w-full max-w-[220px] text-zinc-600">
            <span>Tax</span>
            <span className="font-mono">{currencyFmt(Number(bill.transaction.tax))}</span>
          </div>
          {Number(bill.transaction.shipping) > 0 && (
            <div className="flex justify-between w-full max-w-[220px] text-zinc-600">
              <span>Shipping</span>
              <span className="font-mono">{currencyFmt(Number(bill.transaction.shipping))}</span>
            </div>
          )}
          <div className="flex justify-between w-full max-w-[220px] text-zinc-900 font-extrabold text-base border-t border-zinc-200 pt-1.5 mt-1">
            <span>Total</span>
            <span className="font-mono text-indigo-650">{currencyFmt(Number(bill.transaction.total))}</span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">Cashier: {bill.transaction.cashier.name}</p>
        </div>
      </div>
    </main>
  );
}

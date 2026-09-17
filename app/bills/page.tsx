import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Receipt, Lock, Ban, DollarSign, Calendar, ArrowRight, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const currencyFmt = (val: number) =>
  `Rs ${val.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Same badge mapping Bill detail uses for a bill's status — kept
// identical here rather than reinvented per page.
function statusBadge(status: string) {
  const variant = status === "locked" ? "default" : status === "voided" ? "destructive" : "warning";
  return (
    <Badge variant={variant} className="capitalize">
      {status}
    </Badge>
  );
}

export default async function BillsPage() {
  const bills = await prisma.bill.findMany({
    orderBy: { lockedAt: "desc" },
    take: 50,
    include: {
      transaction: { include: { customer: true, cashier: true } },
    },
  });

  const lockedCount = bills.filter((b) => b.status === "locked").length;
  const voidedCount = bills.filter((b) => b.status === "voided").length;
  const totalValue = bills.reduce((sum, b) => sum + Number(b.transaction.total), 0);

  return (
    <main className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-650">
              <Receipt className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Bills</h1>
          </div>
          <p className="text-xs text-zinc-500 mt-1 pl-11">
            Locked sales records from completed POS checkouts.
          </p>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Total Bills</span>
            <div className="text-2xl font-extrabold text-zinc-900">{bills.length}</div>
            <span className="text-[12px] text-zinc-500 font-medium">Most recent 50 shown</span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
            <Receipt className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Locked</span>
            <div className="text-2xl font-extrabold text-zinc-900">{lockedCount}</div>
            <span className="text-[12px] text-zinc-500 font-medium">Closed, unmodifiable sales</span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <Lock className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Voided</span>
            <div className="text-2xl font-extrabold text-zinc-900">{voidedCount}</div>
            <span className="text-[12px] text-zinc-500 font-medium">Cancelled sales, stock restored</span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-red-50 border border-red-100 text-red-600 flex items-center justify-center shrink-0">
            <Ban className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Total Value</span>
            <div className="text-xl font-extrabold text-zinc-900 font-mono">{currencyFmt(totalValue)}</div>
            <span className="text-[12px] text-zinc-500 font-medium">Across bills shown</span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
            <DollarSign className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-zinc-150 bg-zinc-50/50 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-600 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-zinc-500" /> Bill History
          </h2>
          <span className="text-xs text-zinc-400 font-medium">Showing latest {bills.length} bills</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-50 text-zinc-650 font-bold border-b border-zinc-150 uppercase tracking-wider text-xs">
              <tr>
                <th className="px-4 py-3.5">Date</th>
                <th className="px-4 py-3.5">Bill Ref</th>
                <th className="px-4 py-3.5">Customer</th>
                <th className="px-4 py-3.5">Cashier</th>
                <th className="px-4 py-3.5">Payment</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Total</th>
                <th className="px-4 py-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200/70 text-sm">
              {bills.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-zinc-400">
                    <div className="sticky left-1/2 w-fit -translate-x-1/2 flex flex-col items-center justify-center gap-2">
                      <Receipt className="h-8 w-8 text-zinc-300" />
                      <p className="font-semibold text-zinc-600">No bills yet</p>
                      <p className="text-xs text-zinc-400">Completed POS sales lock into a bill automatically.</p>
                    </div>
                  </td>
                </tr>
              )}
              {bills.map((bill) => (
                <tr key={bill.id} className="hover:bg-indigo-50/20 transition-colors">
                  <td className="px-4 py-3.5 text-zinc-600 font-medium whitespace-nowrap">
                    {bill.lockedAt.toLocaleDateString("en-GB").replace(/\//g, "-")}
                  </td>
                  <td className="px-4 py-3.5 font-mono font-bold text-indigo-650 uppercase" title={bill.id}>
                    {bill.id.slice(-8)}
                  </td>
                  <td className="px-4 py-3.5 text-zinc-700 font-semibold">
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-zinc-400" />
                      {bill.transaction.customer?.name ?? "Walk-In"}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-zinc-600">{bill.transaction.cashier.name}</td>
                  <td className="px-4 py-3.5 text-zinc-600 capitalize font-medium">
                    {bill.transaction.paymentMethod.replace("_", " ")}
                  </td>
                  <td className="px-4 py-3.5">{statusBadge(bill.status)}</td>
                  <td className="px-4 py-3.5 text-right font-mono font-extrabold text-indigo-650">
                    {currencyFmt(Number(bill.transaction.total))}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <Link
                      href={`/bills/${bill.id}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-indigo-650 hover:text-indigo-800 hover:underline"
                    >
                      View <ArrowRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { redirect } from "next/navigation";
import {
  History,
  Plus,
  ShoppingBag,
  TrendingUp,
  Truck,
  DollarSign,
  CheckCircle2,
  Calendar,
  Layers,
  Store,
} from "lucide-react";

export const dynamic = "force-dynamic";

const currencyFmt = (val: number) =>
  `Rs ${val.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function PurchasesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const allowed = await checkPermission(user.role, PERMISSIONS.PURCHASE_VIEW);
  if (!allowed) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-2 px-6 py-16">
        <h1 className="text-xl font-semibold text-zinc-800">Access Denied</h1>
        <p className="text-sm text-zinc-500">You don&apos;t have permission to view purchases.</p>
      </main>
    );
  }

  const [purchases, canCreate] = await Promise.all([
    prisma.purchase.findMany({
      include: { supplier: true, items: true, location: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    checkPermission(user.role, PERMISSIONS.PURCHASE_CREATE),
  ]);

  const totalSpend = purchases.reduce((sum, p) => sum + Number(p.totalAmount), 0);
  const totalItemsCount = purchases.reduce((sum, p) => sum + p.items.reduce((s, i) => s + i.qty, 0), 0);
  const avgOrderValue = purchases.length > 0 ? totalSpend / purchases.length : 0;
  const uniqueSuppliers = new Set(purchases.map((p) => p.supplierId)).size;

  return (
    <main className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-650">
              <History className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Purchase Orders &amp; Stock Receipts</h1>
          </div>
          <p className="text-xs text-zinc-500 mt-1 pl-11">
            Track goods received from suppliers, view procurement history, and manage stock credits.
          </p>
        </div>

        {canCreate && (
          <Link
            href="/purchases/add"
            className="bg-indigo-650 hover:bg-indigo-750 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm shadow-indigo-600/10 active:scale-98"
          >
            <Plus className="h-4 w-4" /> Add Purchase Order
          </Link>
        )}
      </div>

      {/* Modern KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Procurement Spend */}
        <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Total Spend</span>
            <div className="text-xl font-extrabold text-zinc-900 font-mono">
              {currencyFmt(totalSpend)}
            </div>
            <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Across {purchases.length} received orders
            </span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <DollarSign className="h-6 w-6" />
          </div>
        </div>

        {/* Card 2: Received Orders */}
        <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Received Orders</span>
            <div className="text-2xl font-extrabold text-zinc-900">
              {purchases.length} <span className="text-xs font-normal text-zinc-400">POs</span>
            </div>
            <span className="text-[11px] text-zinc-500 font-medium flex items-center gap-1">
              <Layers className="h-3 w-3 text-indigo-500" /> {totalItemsCount} units added to stock
            </span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
            <ShoppingBag className="h-6 w-6" />
          </div>
        </div>

        {/* Card 3: Avg Order Value */}
        <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Avg Order Value</span>
            <div className="text-xl font-extrabold text-zinc-900 font-mono">
              {currencyFmt(avgOrderValue)}
            </div>
            <span className="text-[11px] text-zinc-500 font-medium">Per completed purchase</span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
            <TrendingUp className="h-6 w-6" />
          </div>
        </div>

        {/* Card 4: Active Suppliers */}
        <div className="bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Active Suppliers</span>
            <div className="text-2xl font-extrabold text-zinc-900">
              {uniqueSuppliers} <span className="text-xs font-normal text-zinc-400">Vendors</span>
            </div>
            <span className="text-[11px] text-zinc-500 font-medium flex items-center gap-1">
              <Truck className="h-3 w-3 text-amber-500" /> Active vendor partners
            </span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center shrink-0">
            <Truck className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Main Table Card Structure */}
      <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-zinc-150 bg-zinc-50/50 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-600 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-zinc-500" /> Purchase Orders History
          </h2>
          <span className="text-xs text-zinc-400 font-medium">Showing latest 200 orders</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-50 text-zinc-650 font-bold border-b border-zinc-150 uppercase tracking-wider text-xs">
              <tr>
                <th className="px-4 py-3.5">Date</th>
                <th className="px-4 py-3.5">Reference No.</th>
                <th className="px-4 py-3.5">Supplier</th>
                <th className="px-4 py-3.5">Location</th>
                <th className="px-4 py-3.5 text-center">Items</th>
                <th className="px-4 py-3.5">Payment Method</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Total Amount</th>
                <th className="px-4 py-3.5 text-right">Amount Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200/70 text-sm">
              {purchases.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-zinc-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ShoppingBag className="h-8 w-8 text-zinc-300" />
                      <p className="font-semibold text-zinc-600">No purchases recorded yet</p>
                      <p className="text-xs text-zinc-400">
                        Click &quot;Add Purchase Order&quot; to receive stock from a supplier.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
              {purchases.map((p) => (
                <tr key={p.id} className="hover:bg-indigo-50/20 transition-colors">
                  <td className="px-4 py-3.5 text-zinc-600 font-medium">
                    {p.createdAt.toLocaleDateString("en-GB").replace(/\//g, "-")}
                  </td>
                  <td className="px-4 py-3.5 font-mono font-bold text-indigo-650">{p.referenceNo}</td>
                  <td className="px-4 py-3.5 font-bold text-zinc-800">
                    <div className="flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5 text-zinc-400" />
                      {p.supplier.name}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-zinc-600">
                    <div className="flex items-center gap-1 text-xs">
                      <Store className="h-3.5 w-3.5 text-zinc-400" />
                      {p.location?.name ?? "Default Store"}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-center font-semibold text-zinc-700">
                    <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 text-xs">
                      {p.items.length} lines ({p.items.reduce((acc, i) => acc + i.qty, 0)} units)
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-zinc-600 capitalize font-medium">
                    {p.paymentMethod.replace("_", " ")}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" /> {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono font-extrabold text-indigo-650">
                    {currencyFmt(Number(p.totalAmount))}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-zinc-700 font-semibold">
                    {currencyFmt(Number(p.amountPaid))}
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

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { redirect } from "next/navigation";
import { History, Plus } from "lucide-react";

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

  return (
    <main className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-zinc-800 tracking-tight flex items-center gap-2">
            <History className="h-6 w-6 text-indigo-650" /> Purchases
          </h1>
          <p className="text-xs text-zinc-450 mt-1">
            Goods received from suppliers — {purchases.length} orders, {currencyFmt(totalSpend)} total spend.
          </p>
        </div>
        {canCreate && (
          <Link
            href="/purchases/add"
            className="bg-indigo-650 hover:bg-indigo-750 text-white px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" /> Add Purchase
          </Link>
        )}
      </div>

      <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-50 text-zinc-650 font-bold border-b border-zinc-150 uppercase tracking-wider text-xs">
              <tr>
                <th className="px-4 py-3.5">Date</th>
                <th className="px-4 py-3.5">Reference No.</th>
                <th className="px-4 py-3.5">Supplier</th>
                <th className="px-4 py-3.5">Location</th>
                <th className="px-4 py-3.5 text-center">Line Items</th>
                <th className="px-4 py-3.5">Payment Method</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Total</th>
                <th className="px-4 py-3.5 text-right">Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-sm">
              {purchases.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-zinc-400">
                    No purchases recorded yet.
                  </td>
                </tr>
              )}
              {purchases.map((p) => (
                <tr key={p.id} className="hover:bg-zinc-50/50 transition">
                  <td className="px-4 py-3.5 text-zinc-600">
                    {p.createdAt.toLocaleDateString("en-GB").replace(/\//g, "-")}
                  </td>
                  <td className="px-4 py-3.5 font-mono font-semibold text-zinc-700">{p.referenceNo}</td>
                  <td className="px-4 py-3.5 font-bold text-zinc-800">{p.supplier.name}</td>
                  <td className="px-4 py-3.5 text-zinc-600">{p.location?.name ?? "—"}</td>
                  <td className="px-4 py-3.5 text-center text-zinc-600">{p.items.length}</td>
                  <td className="px-4 py-3.5 text-zinc-600 capitalize">{p.paymentMethod}</td>
                  <td className="px-4 py-3.5">
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-50 text-green-700">
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono font-bold text-indigo-600">
                    {currencyFmt(Number(p.totalAmount))}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-zinc-600">
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

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { SalesActionsMenu } from "./_SalesActionsMenu";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

export default async function AllSalesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const transactions = await prisma.transaction.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { customer: true, tenders: true, bill: true },
  });

  const hasRequestPermission = await checkPermission(user.role, PERMISSIONS.BILLS_REQUEST_CHANGE);

  const fmt = (n: number) =>
    `Rs ${n.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <main className="flex-1 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">All Sales Transactions</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Review completed, due, and voided register transactions</p>
        </div>
        <Link
          href="/pos"
          className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition shadow-sm flex items-center gap-1.5"
        >
          <span>+ Open POS Register</span>
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-950">
        <table className="w-full text-left text-xs table-fixed">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 select-none">
            <tr>
              <th className="px-4 py-3 w-[20%]">Invoice & Time</th>
              <th className="px-4 py-3 w-[22%]">Customer</th>
              <th className="px-3 py-3 w-[12%]">Register</th>
              <th className="px-3 py-3 w-[14%]">Status</th>
              <th className="px-3 py-3 w-[12%]">Tender</th>
              <th className="px-4 py-3 text-right w-[12%]">Amount</th>
              <th className="px-3 py-3 text-center w-[8%]">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-850">
            {transactions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center text-zinc-400">
                  No transaction records found.
                </td>
              </tr>
            )}
            {transactions.map((tx) => {
              const totalPaid = tx.tenders.reduce((sum, t) => sum + Number(t.amount), 0);
              const total = Number(tx.total);
              const due = Math.max(0, Math.round((total - totalPaid) * 100) / 100);
              const voided = tx.status === "voided";
              const canRequestChange = !voided && hasRequestPermission && !!tx.bill;

              return (
                <tr key={tx.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-900/50 transition">
                  {/* Invoice & Date */}
                  <td className="px-4 py-3">
                    <p className="font-mono font-bold text-zinc-900 dark:text-white uppercase tracking-wide">
                      #{tx.id.slice(-8)}
                    </p>
                    <p className="text-[10.5px] text-zinc-400 font-mono mt-0.5">
                      {tx.createdAt.toLocaleDateString("en-GB")} {tx.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </td>

                  {/* Customer & Phone */}
                  <td className="px-4 py-3">
                    <p className="font-bold text-zinc-800 dark:text-zinc-200 truncate">
                      {tx.customer?.name ?? "Walk-In Customer"}
                    </p>
                    <p className="text-[10.5px] text-zinc-400 font-mono">
                      {tx.customer?.phone ?? "No phone"}
                    </p>
                  </td>

                  {/* Register Location */}
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-[10.5px] font-semibold text-zinc-750 dark:bg-zinc-850 dark:text-zinc-300">
                      {tx.registerId}
                    </span>
                  </td>

                  {/* Accessible Status Badge */}
                  <td className="px-3 py-3">
                    {voided ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-bold text-red-700 dark:bg-red-950/30 dark:text-red-400">
                        ✕ Voided
                      </span>
                    ) : due > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                        ⏳ Due (Rs {due.toFixed(0)})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                        ✓ Paid
                      </span>
                    )}
                  </td>

                  {/* Payment Method */}
                  <td className="px-3 py-3 capitalize text-zinc-600 dark:text-zinc-350 font-medium">
                    {tx.paymentMethod}
                  </td>

                  {/* Amount & Due */}
                  <td className="px-4 py-3 text-right">
                    <p className="font-mono font-extrabold text-zinc-900 dark:text-white tabular-nums text-[13px]">
                      {fmt(total)}
                    </p>
                    {due > 0 && (
                      <p className="text-[10px] font-mono text-amber-600 font-bold tabular-nums">
                        Due: {fmt(due)}
                      </p>
                    )}
                  </td>

                  {/* Action Menu */}
                  <td className="px-3 py-3 text-center">
                    <SalesActionsMenu
                      transactionId={tx.id}
                      billId={tx.bill?.id}
                      canVoid={!voided && user.role === "ADMIN"}
                      canRequestChange={canRequestChange}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}

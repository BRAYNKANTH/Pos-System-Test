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
        <h1 className="text-xl font-semibold tracking-tight">All Sales</h1>
        <Link
          href="/pos"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          + Add Sale
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <table className="w-full text-left text-xs">
          <thead className="border-b bg-zinc-50 text-xs font-bold uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-2.5">Action</th>
              <th className="px-4 py-2.5">Date</th>
              <th className="px-4 py-2.5">Invoice No.</th>
              <th className="px-4 py-2.5">Customer name</th>
              <th className="px-4 py-2.5">Contact Number</th>
              <th className="px-4 py-2.5">Location</th>
              <th className="px-4 py-2.5">Payment Status</th>
              <th className="px-4 py-2.5">Payment Method</th>
              <th className="px-4 py-2.5">Total amount</th>
              <th className="px-4 py-2.5">Total paid</th>
              <th className="px-4 py-2.5">Sell Due</th>
              <th className="px-4 py-2.5">Sell Return Due</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 text-sm dark:divide-zinc-900">
            {transactions.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-10 text-center text-zinc-400">
                  No data available in table
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
                <tr key={tx.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                  <td className="px-4 py-2.5">
                    <SalesActionsMenu
                      transactionId={tx.id}
                      billId={tx.bill?.id}
                      canVoid={!voided && user.role === "ADMIN"}
                      canRequestChange={canRequestChange}
                    />
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-zinc-500">
                    {tx.createdAt.toLocaleDateString()}{" "}
                    {tx.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-zinc-400">{tx.id.slice(-8)}</td>
                  <td className="px-4 py-2.5 font-medium">
                    {tx.customer?.name ?? "Walk-In Customer"}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-500">{tx.customer?.phone ?? "—"}</td>
                  <td className="px-4 py-2.5 text-zinc-500">{tx.registerId}</td>
                  <td className="px-4 py-2.5">
                    {voided ? (
                      <Badge variant="destructive">Voided</Badge>
                    ) : due > 0 ? (
                      <Badge variant="warning">Due</Badge>
                    ) : (
                      <Badge variant="success">Paid</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2.5 capitalize text-zinc-500">{tx.paymentMethod}</td>
                  <td className="px-4 py-2.5 font-mono">{fmt(total)}</td>
                  <td className="px-4 py-2.5 font-mono">{fmt(totalPaid)}</td>
                  <td className="px-4 py-2.5 font-mono text-amber-600">{fmt(due)}</td>
                  <td className="px-4 py-2.5 font-mono text-zinc-400">{fmt(0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}

import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SalesReturnsClient } from "./SalesReturnsClient";

export const dynamic = "force-dynamic";

const currencyFmt = (val: number) =>
  `Rs ${val.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function SellReturnsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const allowed = await checkPermission(user.role, PERMISSIONS.SALES_RETURN_VIEW);
  if (!allowed) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-2 px-6 py-16">
        <h1 className="text-xl font-semibold text-zinc-800">Access Denied</h1>
        <p className="text-sm text-zinc-500">You don&apos;t have permission to view sales returns.</p>
      </main>
    );
  }

  const [returns, canCreate] = await Promise.all([
    prisma.salesReturn.findMany({
      include: { items: true, transaction: { include: { customer: true } }, createdBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    checkPermission(user.role, PERMISSIONS.SALES_RETURN_CREATE),
  ]);

  const rows = returns.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toLocaleDateString("en-GB").replace(/\//g, "-"),
    transactionId: r.transactionId,
    customerName: r.transaction.customer?.name ?? "Walk-In",
    itemCount: r.items.length,
    refundAmount: currencyFmt(Number(r.refundAmount)),
    refundMethod: r.refundMethod,
    reason: r.reason,
    createdBy: r.createdBy.name,
    isExchange: r.isExchange,
    exchangeTotal: currencyFmt(Number(r.exchangeTotal)),
    netAmount: Number(r.netAmount),
    netAmountFmt: currencyFmt(Math.abs(Number(r.netAmount))),
  }));

  return (
    <main className="p-6 space-y-6 max-w-6xl mx-auto">
      <SalesReturnsClient initialReturns={rows} canCreate={canCreate} />
    </main>
  );
}

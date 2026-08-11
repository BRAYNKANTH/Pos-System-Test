import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import DashboardClient from "./_components/DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // Fetch real statistics from the DB. Was previously two separate,
  // sequential, unbounded `findMany()` calls fetching every column of
  // every row just to sum a couple of fields in JS — on a connection
  // with real network latency, that's the difference between one fast
  // DB-side aggregate and two slow full-table transfers. Now: one
  // DB-side sum (`aggregate`) + one narrow, bounded `findMany`, run in
  // parallel.
  const [completedAgg, unpaidTransactions] = await Promise.all([
    prisma.transaction.aggregate({
      where: { status: "completed" },
      _sum: { total: true, subtotal: true },
    }),
    prisma.transaction.findMany({
      where: { status: { notIn: ["completed", "voided"] } },
      select: { id: true, total: true },
      take: 50,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Sum calculations
  const totalSalesVal = Number(completedAgg._sum.total ?? 0);
  const netRevenueVal = Number(completedAgg._sum.subtotal ?? 0);
  const invoiceDueVal = unpaidTransactions.reduce((sum, t) => sum + Number(t.total), 0);

  const stats = {
    totalSales: totalSalesVal,
    netRevenue: netRevenueVal,
    invoiceDue: invoiceDueVal,
    sellReturns: 0.0,
    totalPurchase: 0.0,
    purchaseDue: 0.0,
    purchaseReturns: 0.0,
    expenses: 1250.0, // Mock baseline expense
  };

  const formattedUnpaid = unpaidTransactions.map((tx) => ({
    id: tx.id,
    total: Number(tx.total),
  }));

  return (
    <DashboardClient
      user={{ name: user.name, role: user.role }}
      stats={stats}
      unpaidTransactions={formattedUnpaid}
    />
  );
}

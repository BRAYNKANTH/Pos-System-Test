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

  // Calculate Today's date range (00:00:00 to 23:59:59 local server time)
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  // Fetch real statistics from DB concurrently
  const [
    todayCompletedAgg,
    todayCompletedCount,
    todayPurchasesAgg,
    allTimeCompletedAgg,
    allTimePurchasesAgg,
    unpaidTransactions,
    todayTransactionsList,
  ] = await Promise.all([
    // Today's completed sales
    prisma.transaction.aggregate({
      where: {
        status: "completed",
        createdAt: { gte: startOfToday, lte: endOfToday },
      },
      _sum: { total: true, subtotal: true },
    }),
    // Today's order count
    prisma.transaction.count({
      where: {
        status: "completed",
        createdAt: { gte: startOfToday, lte: endOfToday },
      },
    }),
    // Today's goods received purchases
    prisma.purchase.aggregate({
      where: {
        createdAt: { gte: startOfToday, lte: endOfToday },
      },
      _sum: { totalAmount: true },
    }),
    // All time completed sales
    prisma.transaction.aggregate({
      where: { status: "completed" },
      _sum: { total: true, subtotal: true },
    }),
    // All time purchases
    prisma.purchase.aggregate({
      where: { status: "Completed" },
      _sum: { totalAmount: true },
    }),
    // Unpaid/Due transactions
    prisma.transaction.findMany({
      where: { status: { notIn: ["completed", "voided"] } },
      select: { id: true, total: true, customer: { select: { name: true } }, createdAt: true },
      take: 50,
      orderBy: { createdAt: "desc" },
    }),
    // Today's recent transactions list for daily review
    prisma.transaction.findMany({
      where: {
        createdAt: { gte: startOfToday, lte: endOfToday },
      },
      select: {
        id: true,
        total: true,
        subtotal: true,
        paymentMethod: true,
        status: true,
        createdAt: true,
        cashier: { select: { name: true } },
        customer: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  // Today calculations
  const todaySalesVal = Number(todayCompletedAgg._sum.total ?? 0);
  const todayNetRevenueVal = Number(todayCompletedAgg._sum.subtotal ?? 0);
  const todayPurchaseVal = Number(todayPurchasesAgg._sum.totalAmount ?? 0);

  // All time calculations
  const allTimeSalesVal = Number(allTimeCompletedAgg._sum.total ?? 0);
  const allTimeNetRevenueVal = Number(allTimeCompletedAgg._sum.subtotal ?? 0);
  const allTimePurchaseVal = Number(allTimePurchasesAgg._sum.totalAmount ?? 0);
  const invoiceDueVal = unpaidTransactions.reduce((sum, t) => sum + Number(t.total), 0);

  const stats = {
    // Today's daily metrics (Default view)
    todaySales: todaySalesVal,
    todayNetRevenue: todayNetRevenueVal,
    todayOrderCount: todayCompletedCount,
    todayPurchase: todayPurchaseVal,

    // All time metrics
    allTimeSales: allTimeSalesVal,
    allTimeNetRevenue: allTimeNetRevenueVal,
    allTimePurchase: allTimePurchaseVal,

    // Active Dashboard metrics (defaults to Today's Sales for daily review)
    totalSales: todaySalesVal,
    netRevenue: todayNetRevenueVal,
    invoiceDue: invoiceDueVal,
    sellReturns: 0.0,
    totalPurchase: todayPurchaseVal,
    purchaseDue: 0.0,
    purchaseReturns: 0.0,
    expenses: 0.0,
  };

  const formattedUnpaid = unpaidTransactions.map((tx) => ({
    id: tx.id,
    customerName: tx.customer?.name || "Walk-In Customer",
    total: Number(tx.total),
  }));

  const formattedTodayTransactions = todayTransactionsList.map((tx) => ({
    id: tx.id,
    total: Number(tx.total),
    subtotal: Number(tx.subtotal),
    paymentMethod: tx.paymentMethod,
    status: tx.status,
    cashierName: tx.cashier.name,
    customerName: tx.customer?.name || "Walk-In Customer",
    time: tx.createdAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
  }));

  return (
    <DashboardClient
      user={{ name: user.name, role: user.role }}
      stats={stats}
      unpaidTransactions={formattedUnpaid}
      todayTransactions={formattedTodayTransactions}
    />
  );
}

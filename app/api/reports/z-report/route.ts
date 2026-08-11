import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";

// generateZReport — GET /api/reports/z-report?date=YYYY-MM-DD — daily cash
// register reconciliation. Defaults to today (server-local date) if no
// date is given.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.REPORTS_VIEW))) {
    return apiError("FORBIDDEN", "Not allowed to view reports", { status: 403 });
  }

  const dateParam = req.nextUrl.searchParams.get("date");
  const date = dateParam ? new Date(dateParam) : new Date();
  if (Number.isNaN(date.getTime())) {
    return apiError("INVALID_INPUT", "date must be a valid date (YYYY-MM-DD)", { status: 400 });
  }
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  const transactions = await prisma.transaction.findMany({
    where: { createdAt: { gte: start, lt: end } },
  });

  const byMethod: Record<string, { count: number; total: number }> = {};
  let grossSales = 0;
  let totalTax = 0;
  for (const tx of transactions) {
    grossSales += Number(tx.total);
    totalTax += Number(tx.tax);
    const method = tx.paymentMethod;
    byMethod[method] ??= { count: 0, total: 0 };
    byMethod[method].count += 1;
    byMethod[method].total += Number(tx.total);
  }

  return apiSuccess({
    date: start.toISOString().slice(0, 10),
    transactionCount: transactions.length,
    grossSales: Math.round(grossSales * 100) / 100,
    totalTax: Math.round(totalTax * 100) / 100,
    byPaymentMethod: byMethod,
  });
}

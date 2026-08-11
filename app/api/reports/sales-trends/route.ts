import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";

// getSalesTrends — GET /api/reports/sales-trends — top items, profit
// margin*, trend data. (*No cost-basis field exists on InventoryItem in
// the build plan's schema, so "profit margin" isn't computable — this
// returns revenue/qty ranking instead, documented here rather than
// silently inventing a cost field.)
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.REPORTS_VIEW))) {
    return apiError("FORBIDDEN", "Not allowed to view reports", { status: 403 });
  }

  const items = await prisma.transactionItem.findMany();
  const bySku = new Map<string, { qty: number; revenue: number }>();
  for (const item of items) {
    const revenue = Number(item.unitPrice) * item.qty - Number(item.discount);
    const existing = bySku.get(item.sku) ?? { qty: 0, revenue: 0 };
    existing.qty += item.qty;
    existing.revenue += revenue;
    bySku.set(item.sku, existing);
  }

  const skus = [...bySku.keys()];
  const inventoryItems = await prisma.inventoryItem.findMany({ where: { sku: { in: skus } } });
  const nameBySku = new Map(inventoryItems.map((i) => [i.sku, i.name]));

  const trends = [...bySku.entries()]
    .map(([sku, agg]) => ({
      sku,
      name: nameBySku.get(sku) ?? sku,
      qtySold: agg.qty,
      revenue: Math.round(agg.revenue * 100) / 100,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return apiSuccess(trends);
}

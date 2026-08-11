import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";

export default async function SalesTrendsPage() {
  const user = await getCurrentUser();
  const allowed = user && (await checkPermission(user.role, PERMISSIONS.REPORTS_VIEW));
  if (!allowed) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-2 px-6 py-16">
        <p className="text-sm text-zinc-500">You don&apos;t have permission to view reports.</p>
      </main>
    );
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
    .map(([sku, agg]) => ({ sku, name: nameBySku.get(sku) ?? sku, ...agg }))
    .sort((a, b) => b.revenue - a.revenue);

  const maxRevenue = Math.max(...trends.map((t) => t.revenue), 1);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-6 py-12">
      <h1 className="text-xl font-semibold tracking-tight">Sales Trends</h1>
      <p className="text-xs text-zinc-500">Top items by revenue, all time.</p>

      <div className="flex flex-col gap-3">
        {trends.length === 0 && <p className="text-sm text-zinc-400">No sales yet.</p>}
        {trends.map((t) => (
          <div key={t.sku} className="flex flex-col gap-1">
            <div className="flex justify-between text-sm">
              <span>
                {t.name} <span className="text-xs text-zinc-400">({t.qty} sold)</span>
              </span>
              <span>${t.revenue.toFixed(2)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-blue-600 dark:bg-blue-500"
                style={{ width: `${(t.revenue / maxRevenue) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

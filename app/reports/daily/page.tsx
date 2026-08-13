import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";

export default async function DailyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await getCurrentUser();
  const allowed = user && (await checkPermission(user.role, PERMISSIONS.REPORTS_VIEW));
  if (!allowed) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-2 px-6 py-16">
        <p className="text-sm text-zinc-500">You don&apos;t have permission to view reports.</p>
      </main>
    );
  }

  const { date: dateParam } = await searchParams;
  const date = dateParam ? new Date(dateParam) : new Date();
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
    byMethod[tx.paymentMethod] ??= { count: 0, total: 0 };
    byMethod[tx.paymentMethod].count += 1;
    byMethod[tx.paymentMethod].total += Number(tx.total);
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-6 py-12">
      <h1 className="text-xl font-semibold tracking-tight">Daily Reconciliation (Z-Report)</h1>

      <form className="flex gap-2">
        <input
          type="date"
          name="date"
          defaultValue={start.toISOString().slice(0, 10)}
          className="h-9 rounded-md border border-zinc-200 bg-transparent px-3 text-sm dark:border-zinc-800"
        />
        <button
          type="submit"
          className="h-9 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Go
        </button>
      </form>

      <div className="grid grid-cols-3 gap-3 text-center text-sm">
        <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
          <p className="text-xs text-zinc-500">Transactions</p>
          <p className="text-lg font-semibold">{transactions.length}</p>
        </div>
        <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
          <p className="text-xs text-zinc-500">Gross sales</p>
          <p className="text-lg font-semibold">Rs {grossSales.toFixed(2)}</p>
        </div>
        <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
          <p className="text-xs text-zinc-500">Tax collected</p>
          <p className="text-lg font-semibold">Rs {totalTax.toFixed(2)}</p>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold">By payment method</h2>
        <div className="flex flex-col divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {Object.entries(byMethod).length === 0 && (
            <p className="p-4 text-sm text-zinc-400">No transactions for this date.</p>
          )}
          {Object.entries(byMethod).map(([method, agg]) => (
            <div key={method} className="flex justify-between p-3 text-sm capitalize">
              <span>
                {method} ({agg.count})
              </span>
              <span>Rs {agg.total.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

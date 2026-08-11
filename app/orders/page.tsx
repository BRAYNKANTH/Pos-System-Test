import { prisma } from "@/lib/prisma";
import { OrderStatusSelect } from "./_OrderStatusSelect";

export default async function OrdersPage() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { customer: true },
  });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-6 py-12">
      <h1 className="text-xl font-semibold tracking-tight">Order Status Tracker</h1>
      <div className="flex flex-col divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {orders.length === 0 && (
          <p className="p-4 text-sm text-zinc-400">
            No orders yet. Orders are created per-customer from their profile page.
          </p>
        )}
        {orders.map((o) => (
          <div key={o.id} className="flex items-center justify-between gap-2 p-3 text-sm">
            <div>
              <p>{o.customer.name}</p>
              <p className="text-xs text-zinc-400">{o.createdAt.toLocaleString()}</p>
            </div>
            <OrderStatusSelect orderId={o.id} status={o.status} />
          </div>
        ))}
      </div>
    </main>
  );
}

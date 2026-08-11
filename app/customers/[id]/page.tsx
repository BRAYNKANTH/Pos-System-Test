import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { NewOrderButton } from "./_NewOrderButton";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: { orders: { orderBy: { createdAt: "desc" } } },
  });
  if (!customer) notFound();

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-6 py-12">
      <Link href="/customers" className="text-xs text-zinc-500 hover:underline">
        ← Customers
      </Link>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{customer.name}</h1>
        <p className="text-sm text-zinc-500">
          {customer.email ?? "—"} · {customer.phone ?? "—"}
        </p>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Orders</h2>
          <NewOrderButton customerId={customer.id} />
        </div>
        <div className="flex flex-col divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {customer.orders.length === 0 && (
            <p className="p-4 text-sm text-zinc-400">No orders yet.</p>
          )}
          {customer.orders.map((o) => (
            <div key={o.id} className="flex items-center justify-between p-3 text-sm">
              <span className="font-mono text-xs text-zinc-400">{o.id}</span>
              <span className="text-xs text-zinc-400">{o.createdAt.toLocaleString()}</span>
              <Badge
                variant={
                  o.status === "fulfilled" ? "success" : o.status === "refunded" ? "destructive" : "warning"
                }
              >
                {o.status}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

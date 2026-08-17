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

      {/* Loyalty Card Card */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-900 to-indigo-950 text-white shadow-md space-y-2 border border-indigo-800">
        <div className="flex justify-between items-center">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-300">
            🏆 {customer.loyaltyTier || "Bronze"} Member
          </span>
          <span className="text-xs font-mono font-bold bg-indigo-800/80 px-2 py-0.5 rounded text-indigo-200">
            Loyalty Card
          </span>
        </div>
        <div className="flex justify-between items-baseline pt-1">
          <div>
            <span className="text-2xl font-black font-mono">{customer.loyaltyPoints ?? 0}</span>
            <span className="text-xs text-indigo-300 ml-1">Points</span>
          </div>
          <span className="text-xs font-semibold text-emerald-400">
            = Rs {((customer.loyaltyPoints ?? 0) * 0.1).toFixed(2)} Redeemable Value
          </span>
        </div>
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

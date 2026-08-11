import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function InventoryItemPage({ params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params;
  const item = await prisma.inventoryItem.findUnique({ where: { sku } });
  if (!item) notFound();

  const history = await prisma.stockAdjustment.findMany({
    where: { sku },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { requester: true, approver: true },
  });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-6 py-12">
      <div>
        <Link href="/inventory" className="text-xs text-zinc-500 hover:underline">
          ← Inventory
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">{item.name}</h1>
          <Link href={`/inventory/${item.sku}/adjust`}>
            <Button size="sm">Adjust stock</Button>
          </Link>
        </div>
        <p className="text-sm text-zinc-500">
          {item.sku} · ${Number(item.unitPrice).toFixed(2)} · {item.qtyOnHand} on hand
          {item.qtyOnHand <= item.lowStockThreshold && (
            <>
              {" "}
              <Badge variant="warning">Low stock</Badge>
            </>
          )}
        </p>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold">History</h2>
        <div className="flex flex-col divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {history.length === 0 && (
            <p className="p-4 text-sm text-zinc-400">No adjustments yet.</p>
          )}
          {history.map((h) => (
            <div key={h.id} className="flex items-center justify-between gap-2 p-3 text-sm">
              <div>
                <p>
                  <span className={h.qtyChange < 0 ? "text-red-600" : "text-green-600"}>
                    {h.qtyChange > 0 ? "+" : ""}
                    {h.qtyChange}
                  </span>{" "}
                  · {h.type} {h.reasonCategory ? `· ${h.reasonCategory}` : ""}
                </p>
                <p className="text-xs text-zinc-400">
                  {h.createdAt.toLocaleString()}
                  {h.requester ? ` · by ${h.requester.name}` : ""}
                  {h.approver ? ` · approved by ${h.approver.name}` : ""}
                </p>
              </div>
              <Badge
                variant={
                  h.status === "applied" ? "success" : h.status === "pending" ? "warning" : "destructive"
                }
              >
                {h.status}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

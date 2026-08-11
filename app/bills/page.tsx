import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";

export default async function BillsPage() {
  const bills = await prisma.bill.findMany({
    orderBy: { lockedAt: "desc" },
    take: 50,
    include: { transaction: true },
  });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Bills</h1>
        <Link href="/bills/requests" className="text-sm text-zinc-500 hover:underline">
          My requests →
        </Link>
      </div>
      <div className="flex flex-col divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {bills.length === 0 && <p className="p-4 text-sm text-zinc-400">No bills yet.</p>}
        {bills.map((bill) => (
          <Link
            key={bill.id}
            href={`/bills/${bill.id}`}
            className="flex items-center justify-between gap-2 p-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
          >
            <div>
              <p className="font-mono text-xs text-zinc-400">{bill.id}</p>
              <p>Rs {Number(bill.transaction.total).toFixed(2)}</p>
            </div>
            <Badge
              variant={
                bill.status === "locked" ? "default" : bill.status === "voided" ? "destructive" : "warning"
              }
            >
              {bill.status}
            </Badge>
          </Link>
        ))}
      </div>
    </main>
  );
}

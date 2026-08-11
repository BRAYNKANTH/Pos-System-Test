import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";

export default async function MyRequestsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const requests = await prisma.billChangeRequest.findMany({
    where: { requestedBy: user.id },
    orderBy: { createdAt: "desc" },
    include: { bill: { include: { transaction: true } } },
  });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-6 py-12">
      <h1 className="text-xl font-semibold tracking-tight">My Requests</h1>
      <div className="flex flex-col divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {requests.length === 0 && (
          <p className="p-4 text-sm text-zinc-400">You haven&apos;t submitted any requests.</p>
        )}
        {requests.map((r) => (
          <Link
            key={r.id}
            href={`/bills/${r.billId}`}
            className="flex items-center justify-between gap-2 p-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
          >
            <div>
              <p className="capitalize">
                {r.type} · Rs {Number(r.bill.transaction.total).toFixed(2)}
              </p>
              <p className="text-xs text-zinc-400">
                {r.reason} · {r.createdAt.toLocaleString()}
              </p>
            </div>
            <Badge
              variant={
                r.status === "approved" ? "success" : r.status === "pending" ? "warning" : "destructive"
              }
            >
              {r.status}
            </Badge>
          </Link>
        ))}
      </div>
    </main>
  );
}

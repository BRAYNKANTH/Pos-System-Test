import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VoidSaleButton } from "@/components/VoidSaleButton";

export default async function BillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;
  const bill = await prisma.bill.findUnique({
    where: { id },
    include: {
      transaction: { include: { items: true, cashier: true } },
      changeRequests: { orderBy: { createdAt: "desc" }, include: { requester: true } },
    },
  });
  if (!bill) notFound();

  const canVoid =
    bill.transaction.status === "completed" &&
    user &&
    (await checkPermission(user.role, PERMISSIONS.BILLS_APPROVE));

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-6 py-12">
      <Link href="/bills" className="text-xs text-zinc-500 hover:underline">
        ← Bills
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Bill</h1>
        <Badge
          variant={
            bill.status === "locked" ? "default" : bill.status === "voided" ? "destructive" : "warning"
          }
        >
          {bill.status}
        </Badge>
      </div>
      <p className="-mt-2 font-mono text-xs text-zinc-400">{bill.id}</p>

      <div className="flex flex-col gap-1 rounded-md border border-zinc-200 p-4 text-sm dark:border-zinc-800">
        {bill.transaction.items.map((item) => (
          <div key={item.id} className="flex justify-between">
            <span>
              {item.sku} × {item.qty}
            </span>
            <span>Rs {(Number(item.unitPrice) * item.qty - Number(item.discount)).toFixed(2)}</span>
          </div>
        ))}
        <div className="mt-2 flex justify-between border-t border-zinc-200 pt-2 font-semibold dark:border-zinc-800">
          <span>Total</span>
          <span>Rs {Number(bill.transaction.total).toFixed(2)}</span>
        </div>
        <p className="text-xs text-zinc-400">
          Cashier: {bill.transaction.cashier.name} · {bill.transaction.paymentMethod} · Locked{" "}
          {bill.lockedAt.toLocaleString()}
        </p>
      </div>

      <div className="flex gap-2">
        {bill.status === "locked" && (
          <Link href={`/bills/${bill.id}/request-change`}>
            <Button>Request a change</Button>
          </Link>
        )}
        {canVoid && <VoidSaleButton transactionId={bill.transaction.id} />}
      </div>

      {bill.changeRequests.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold">Change requests</h2>
          <div className="flex flex-col divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {bill.changeRequests.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                <div>
                  <p className="capitalize">
                    {r.type} · {r.reason}
                  </p>
                  <p className="text-xs text-zinc-400">
                    by {r.requester.name} · {r.createdAt.toLocaleString()}
                  </p>
                </div>
                <Badge
                  variant={
                    r.status === "approved"
                      ? "success"
                      : r.status === "pending"
                        ? "warning"
                        : "destructive"
                  }
                >
                  {r.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

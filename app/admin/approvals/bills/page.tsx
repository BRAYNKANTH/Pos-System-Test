import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";

export default async function BillApprovalsPage() {
  const user = await getCurrentUser();
  const allowed = user && (await checkPermission(user.role, PERMISSIONS.BILLS_APPROVE));

  if (!allowed) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-2 px-6 py-16">
        <p className="text-sm text-zinc-500">
          You don&apos;t have permission to view bill change approvals.
        </p>
      </main>
    );
  }

  const pending = await prisma.billChangeRequest.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    include: { requester: true, bill: { include: { transaction: true } } },
  });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-6 py-12">
      <h1 className="text-xl font-semibold tracking-tight">Pending Bill Change Requests</h1>
      {pending.length === 0 && <p className="text-sm text-zinc-400">Nothing pending.</p>}
      <div className="flex flex-col divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {pending.map((r) => (
          <Link
            key={r.id}
            href={`/admin/approvals/bills/${r.id}`}
            className="flex items-center justify-between gap-2 p-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
          >
            <div>
              <p className="capitalize">
                {r.type} · Rs {Number(r.bill.transaction.total).toFixed(2)}
              </p>
              <p className="text-xs text-zinc-400">
                {r.reason} · requested by {r.requester.name}
              </p>
            </div>
            <span className="text-xs text-zinc-400">{r.createdAt.toLocaleDateString()}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}

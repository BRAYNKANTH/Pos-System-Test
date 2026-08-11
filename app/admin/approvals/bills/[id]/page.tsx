import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { Badge } from "@/components/ui/badge";
import { ApprovalActions } from "@/components/ApprovalActions";

export default async function BillApprovalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const allowed = user && (await checkPermission(user.role, PERMISSIONS.BILLS_APPROVE));
  if (!allowed) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-2 px-6 py-16">
        <p className="text-sm text-zinc-500">You don&apos;t have permission to view this.</p>
      </main>
    );
  }

  const { id } = await params;
  const request = await prisma.billChangeRequest.findUnique({
    where: { id },
    include: { requester: true, bill: { include: { transaction: { include: { items: true } } } } },
  });
  if (!request) notFound();

  const proposed = request.proposedChanges as { description?: string } | null;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-6 py-12">
      <Link href="/admin/approvals/bills" className="text-xs text-zinc-500 hover:underline">
        ← Pending requests
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold capitalize tracking-tight">{request.type} request</h1>
        <Badge
          variant={
            request.status === "approved"
              ? "success"
              : request.status === "pending"
                ? "warning"
                : "destructive"
          }
        >
          {request.status}
        </Badge>
      </div>

      <div className="flex flex-col gap-2 rounded-md border border-zinc-200 p-4 text-sm dark:border-zinc-800">
        <div className="flex justify-between">
          <span className="text-zinc-500">Bill total</span>
          <span>Rs {Number(request.bill.transaction.total).toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Reason</span>
          <span>{request.reason}</span>
        </div>
        {proposed?.description && (
          <div className="flex flex-col gap-1">
            <span className="text-zinc-500">Proposed change</span>
            <p>{proposed.description}</p>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-zinc-500">Requested by</span>
          <span>{request.requester.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Requested at</span>
          <span>{request.createdAt.toLocaleString()}</span>
        </div>
      </div>

      <div className="flex flex-col gap-1 rounded-md border border-zinc-200 p-3 text-xs dark:border-zinc-800">
        {request.bill.transaction.items.map((item) => (
          <div key={item.id} className="flex justify-between">
            <span>
              {item.sku} × {item.qty}
            </span>
            <span>Rs {(Number(item.unitPrice) * item.qty - Number(item.discount)).toFixed(2)}</span>
          </div>
        ))}
      </div>

      {request.status === "pending" && (
        <ApprovalActions
          approveUrl={`/api/bills/requests/${request.id}/approve`}
          rejectUrl={`/api/bills/requests/${request.id}/reject`}
          backHref="/admin/approvals/bills"
        />
      )}
    </main>
  );
}

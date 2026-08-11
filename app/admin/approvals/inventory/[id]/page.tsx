import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { Badge } from "@/components/ui/badge";
import { ApprovalActions } from "@/components/ApprovalActions";

export default async function InventoryApprovalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  const allowed = user && (await checkPermission(user.role, PERMISSIONS.INVENTORY_APPROVE));
  if (!allowed) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-2 px-6 py-16">
        <p className="text-sm text-zinc-500">
          You don&apos;t have permission to view this.
        </p>
      </main>
    );
  }

  const { id } = await params;
  const adjustment = await prisma.stockAdjustment.findUnique({
    where: { id },
    include: { item: true, requester: true },
  });
  if (!adjustment) notFound();

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-6 py-12">
      <Link href="/admin/approvals/inventory" className="text-xs text-zinc-500 hover:underline">
        ← Pending adjustments
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">
          {adjustment.item.name} ({adjustment.sku})
        </h1>
        <Badge
          variant={
            adjustment.status === "applied"
              ? "success"
              : adjustment.status === "pending"
                ? "warning"
                : "destructive"
          }
        >
          {adjustment.status}
        </Badge>
      </div>

      <div className="flex flex-col gap-2 rounded-md border border-zinc-200 p-4 text-sm dark:border-zinc-800">
        <div className="flex justify-between">
          <span className="text-zinc-500">Quantity change</span>
          <span className={adjustment.qtyChange < 0 ? "text-red-600" : "text-green-600"}>
            {adjustment.qtyChange > 0 ? "+" : ""}
            {adjustment.qtyChange}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Current stock on hand</span>
          <span>{adjustment.item.qtyOnHand}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Reason</span>
          <span>{adjustment.reasonCategory}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Requested by</span>
          <span>{adjustment.requester?.name ?? "—"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Requested at</span>
          <span>{adjustment.createdAt.toLocaleString()}</span>
        </div>
      </div>

      {adjustment.status === "pending" && (
        <ApprovalActions
          approveUrl={`/api/inventory/adjustments/${adjustment.id}/approve`}
          rejectUrl={`/api/inventory/adjustments/${adjustment.id}/reject`}
          backHref="/admin/approvals/inventory"
        />
      )}
    </main>
  );
}

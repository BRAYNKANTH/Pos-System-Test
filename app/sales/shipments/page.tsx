import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ShipmentsClient } from "./ShipmentsClient";

export const dynamic = "force-dynamic";

export default async function ShipmentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const allowed = await checkPermission(user.role, PERMISSIONS.SHIPMENT_MANAGE);
  if (!allowed) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-2 px-6 py-16">
        <h1 className="text-xl font-semibold text-zinc-800">Access Denied</h1>
        <p className="text-sm text-zinc-500">You don&apos;t have permission to manage shipments.</p>
      </main>
    );
  }

  const shipments = await prisma.shipment.findMany({
    include: { transaction: { include: { customer: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const rows = shipments.map((s) => ({
    id: s.id,
    transactionId: s.transactionId,
    customerName: s.transaction.customer?.name ?? "Walk-In",
    carrier: s.carrier,
    trackingNumber: s.trackingNumber,
    status: s.status,
    createdAt: s.createdAt.toLocaleDateString("en-GB").replace(/\//g, "-"),
  }));

  return (
    <main className="p-6 space-y-6 max-w-6xl mx-auto">
      <ShipmentsClient initialShipments={rows} />
    </main>
  );
}

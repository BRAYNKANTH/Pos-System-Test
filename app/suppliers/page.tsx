import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { redirect } from "next/navigation";
import { Truck } from "lucide-react";
import { SuppliersClient } from "./SuppliersClient";

export const dynamic = "force-dynamic";

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const allowed = await checkPermission(user.role, PERMISSIONS.SUPPLIER_VIEW);
  if (!allowed) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-2 px-6 py-16">
        <h1 className="text-xl font-semibold text-zinc-800">Access Denied</h1>
        <p className="text-sm text-zinc-500">You don&apos;t have permission to view suppliers.</p>
      </main>
    );
  }

  const { query } = await searchParams;
  const [suppliers, purchaseCounts] = await Promise.all([
    prisma.supplier.findMany({
      where: query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
              { phone: { contains: query, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { name: "asc" },
    }),
    prisma.purchase.groupBy({ by: ["supplierId"], _count: { id: true } }),
  ]);

  const countBySupplier = new Map(purchaseCounts.map((p) => [p.supplierId, p._count.id]));
  const rows = suppliers.map((s) => ({
    ...s,
    purchaseCount: countBySupplier.get(s.id) ?? 0,
  }));

  const canManage = await checkPermission(user.role, PERMISSIONS.SUPPLIER_CREATE);

  return (
    <main className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-zinc-800 tracking-tight flex items-center gap-2">
          <Truck className="h-6 w-6 text-indigo-650" /> Suppliers
        </h1>
        <p className="text-xs text-zinc-450 mt-1">Manage the vendors you buy stock from — linked to Purchases and the Purchase &amp; Sale / Purchase Payment reports.</p>
      </div>

      <SuppliersClient initialSuppliers={rows} query={query ?? ""} canManage={canManage} />
    </main>
  );
}

import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { QuotationsClient } from "./QuotationsClient";

export const dynamic = "force-dynamic";

const currencyFmt = (val: number) =>
  `Rs ${val.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function QuotationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const allowed = await checkPermission(user.role, PERMISSIONS.QUOTATION_VIEW);
  if (!allowed) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-2 px-6 py-16">
        <h1 className="text-xl font-semibold text-zinc-800">Access Denied</h1>
        <p className="text-sm text-zinc-500">You don&apos;t have permission to view quotations.</p>
      </main>
    );
  }

  const quotations = await prisma.quotation.findMany({
    include: { items: true, customer: true, createdBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const rows = quotations.map((q) => ({
    id: q.id,
    referenceNo: q.referenceNo,
    createdAt: q.createdAt.toLocaleDateString("en-GB").replace(/\//g, "-"),
    customerName: q.customer?.name ?? "Walk-In",
    itemCount: q.items.length,
    total: currencyFmt(Number(q.total)),
    status: q.status,
    createdBy: q.createdBy.name,
  }));

  return (
    <main className="p-6 space-y-6 max-w-6xl mx-auto">
      <QuotationsClient initialQuotations={rows} />
    </main>
  );
}

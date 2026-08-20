import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { redirect } from "next/navigation";
import { TaxRatesClient } from "./TaxRatesClient";

export const dynamic = "force-dynamic";

export default async function TaxSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const allowed = await checkPermission(user.role, PERMISSIONS.TAX_MANAGE);
  if (!allowed) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-2 px-6 py-16">
        <h1 className="text-xl font-semibold text-zinc-800">Access Denied</h1>
        <p className="text-sm text-zinc-500">You don&apos;t have permission to manage tax rates.</p>
      </main>
    );
  }

  const rates = await prisma.taxRule.findMany({ orderBy: { createdAt: "asc" } });
  const serialized = rates.map((r) => ({
    id: r.id,
    name: r.name,
    rate: Number(r.rate) * 100,
    rateType: r.rateType,
    isDefault: r.isDefault,
  }));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-800 tracking-tight">Tax Rates</h1>
        <p className="text-xs text-zinc-450 mt-1">Configure VAT, GST, and custom business tax rate categories. The one marked &ldquo;Default&rdquo; is what /pos checkout actually charges.</p>
      </div>

      <TaxRatesClient initialRates={serialized} />
    </div>
  );
}

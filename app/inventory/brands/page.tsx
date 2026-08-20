import { TaxonomyManager } from "../_components/TaxonomyManager";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function BrandsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Mirrors the same permission the write API underneath already requires
  // (see /api/inventory/brands) — the page was previously reachable (and
  // its rename/delete controls visible) to any logged-in user.
  const allowed = await checkPermission(user.role, PERMISSIONS.INVENTORY_ADJUST);
  if (!allowed) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-2 px-6 py-16">
        <h1 className="text-xl font-semibold text-zinc-800">Access Denied</h1>
        <p className="text-sm text-zinc-500">You don&apos;t have permission to manage brands.</p>
      </main>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-800 tracking-tight">Brands</h1>
        <p className="text-xs text-zinc-450 mt-1">Manage the product brands in use across your catalog</p>
      </div>
      <TaxonomyManager label="Brand" apiPath="/api/inventory/brands" />
    </div>
  );
}

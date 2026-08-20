import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { redirect } from "next/navigation";
import { AdjustClient } from "./AdjustClient";

// Server wrapper — mirrors the INVENTORY_ADJUST permission the POST
// underneath already enforces (see /api/inventory/[sku]/adjust/route.ts).
export default async function AdjustPage({ params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const allowed = await checkPermission(user.role, PERMISSIONS.INVENTORY_ADJUST);
  if (!allowed) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-2 px-6 py-16">
        <h1 className="text-xl font-semibold text-zinc-800">Access Denied</h1>
        <p className="text-sm text-zinc-500">You don&apos;t have permission to adjust stock.</p>
      </main>
    );
  }

  return <AdjustClient sku={sku} />;
}

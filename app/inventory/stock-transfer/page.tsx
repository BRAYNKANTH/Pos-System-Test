import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { redirect } from "next/navigation";
import { StockTransferClient } from "./StockTransferClient";

// Server wrapper — mirrors the INVENTORY_TRANSFER permission POST
// /api/inventory/transfer already requires.
export const dynamic = "force-dynamic";

export default async function StockTransferPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const allowed = await checkPermission(user.role, PERMISSIONS.INVENTORY_TRANSFER);
  if (!allowed) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-2 px-6 py-16">
        <h1 className="text-xl font-semibold text-zinc-800">Access Denied</h1>
        <p className="text-sm text-zinc-500">You don&apos;t have permission to transfer stock.</p>
      </main>
    );
  }

  return <StockTransferClient />;
}

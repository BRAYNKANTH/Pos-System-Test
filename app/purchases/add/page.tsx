import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { redirect } from "next/navigation";
import { AddPurchaseClient } from "./AddPurchaseClient";

// Server wrapper — mirrors the PURCHASE_CREATE permission POST
// /api/purchases already requires.
export const dynamic = "force-dynamic";

export default async function AddPurchasePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const allowed = await checkPermission(user.role, PERMISSIONS.PURCHASE_CREATE);
  if (!allowed) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-2 px-6 py-16">
        <h1 className="text-xl font-semibold text-zinc-800">Access Denied</h1>
        <p className="text-sm text-zinc-500">You don&apos;t have permission to record purchases.</p>
      </main>
    );
  }

  return <AddPurchaseClient />;
}

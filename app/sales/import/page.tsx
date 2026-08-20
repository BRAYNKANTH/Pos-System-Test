import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { redirect } from "next/navigation";
import { ImportSalesClient } from "./ImportSalesClient";

// Was a "Coming Soon" placeholder — now the real bulk historical-sales
// import (see /api/sales/import). Gated the same as other bulk
// administrative data operations.
export default async function ImportSalesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const allowed = await checkPermission(user.role, PERMISSIONS.SETTINGS_MANAGE);
  if (!allowed) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-2 px-6 py-16">
        <h1 className="text-xl font-semibold text-zinc-800">Access Denied</h1>
        <p className="text-sm text-zinc-500">You don&apos;t have permission to import sales data.</p>
      </main>
    );
  }

  return <ImportSalesClient />;
}

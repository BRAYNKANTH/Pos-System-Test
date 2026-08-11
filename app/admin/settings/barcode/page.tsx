import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { redirect } from "next/navigation";
import { BarcodeSettingsClient } from "./BarcodeSettingsClient";

export const dynamic = "force-dynamic";

export default async function BarcodeSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const allowed = await checkPermission(user.role, PERMISSIONS.SETTINGS_MANAGE);
  if (!allowed) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-2 px-6 py-16">
        <h1 className="text-xl font-semibold text-zinc-800">Access Denied</h1>
        <p className="text-sm text-zinc-500">You don&apos;t have permission to manage barcode settings.</p>
      </main>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-800 tracking-tight">Barcode Settings</h1>
        <p className="text-xs text-zinc-450 mt-1">Default barcode symbology and label size used by /inventory/print-labels</p>
      </div>

      <BarcodeSettingsClient />
    </div>
  );
}

import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { redirect } from "next/navigation";
import { AddProductClient } from "./AddProductClient";

// Server wrapper — mirrors the INVENTORY_ADJUST permission POST
// /api/inventory already requires. Previously this whole form (and its
// image upload, opening-stock fields, etc.) rendered for any logged-in
// user regardless of role, only to have the actual submit rejected
// server-side.
export const dynamic = "force-dynamic";

export default async function AddProductPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const allowed = await checkPermission(user.role, PERMISSIONS.INVENTORY_ADJUST);
  if (!allowed) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-2 px-6 py-16">
        <h1 className="text-xl font-semibold text-zinc-800">Access Denied</h1>
        <p className="text-sm text-zinc-500">You don&apos;t have permission to add products.</p>
      </main>
    );
  }

  return <AddProductClient />;
}

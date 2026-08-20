import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { redirect } from "next/navigation";
import { AddQuotationClient } from "./AddQuotationClient";

// Server wrapper — mirrors the QUOTATION_CREATE permission POST
// /api/sales/quotations already requires.
export const dynamic = "force-dynamic";

export default async function AddQuotationPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const allowed = await checkPermission(user.role, PERMISSIONS.QUOTATION_CREATE);
  if (!allowed) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-2 px-6 py-16">
        <h1 className="text-xl font-semibold text-zinc-800">Access Denied</h1>
        <p className="text-sm text-zinc-500">You don&apos;t have permission to create quotations.</p>
      </main>
    );
  }

  return <AddQuotationClient />;
}

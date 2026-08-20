import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { redirect } from "next/navigation";
import { RequestChangeClient } from "./RequestChangeClient";

// Server wrapper — mirrors the BILLS_REQUEST_CHANGE permission the POST
// underneath already enforces (see /api/bills/[id]/request-change). The
// form itself used to render for any logged-in user regardless of role,
// only to have the actual submission rejected server-side.
export default async function RequestChangePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const allowed = await checkPermission(user.role, PERMISSIONS.BILLS_REQUEST_CHANGE);
  if (!allowed) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-2 px-6 py-16">
        <h1 className="text-xl font-semibold text-zinc-800">Access Denied</h1>
        <p className="text-sm text-zinc-500">You don&apos;t have permission to request bill changes.</p>
      </main>
    );
  }

  return <RequestChangeClient id={id} />;
}

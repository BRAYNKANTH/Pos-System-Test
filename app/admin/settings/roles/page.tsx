import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import RolesClient from "./RolesClient";

export const dynamic = "force-dynamic";

export default async function RolesSettingsPage() {
  const user = await getCurrentUser();
  const allowed = user && (await checkPermission(user.role, PERMISSIONS.ADMIN_MANAGE_ROLES));
  if (!allowed) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-2 px-6 py-16">
        <p className="text-sm text-zinc-500">You don&apos;t have permission to manage roles.</p>
      </main>
    );
  }

  const grants = await prisma.rolePermission.findMany({
    orderBy: [
      { role: "asc" },
      { permissionKey: "asc" }
    ]
  });

  const formattedGrants = grants.map((g) => ({
    role: g.role,
    permissionKey: g.permissionKey,
  }));

  return <RolesClient initialGrants={formattedGrants} />;
}

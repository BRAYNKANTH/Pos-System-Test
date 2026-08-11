import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { redirect } from "next/navigation";
import { LocationsClient } from "./LocationsClient";

export const dynamic = "force-dynamic";

export default async function LocationsSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const allowed = await checkPermission(user.role, PERMISSIONS.LOCATION_VIEW);
  if (!allowed) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-2 px-6 py-16">
        <h1 className="text-xl font-semibold text-zinc-800">Access Denied</h1>
        <p className="text-sm text-zinc-500">You don&apos;t have permission to view business locations.</p>
      </main>
    );
  }

  const [locations, canManage] = await Promise.all([
    prisma.location.findMany({ orderBy: { createdAt: "asc" } }),
    checkPermission(user.role, PERMISSIONS.LOCATION_MANAGE),
  ]);

  const serialized = locations.map((l) => ({
    id: l.id,
    name: l.name,
    code: l.code,
    city: l.city,
    country: l.country,
    landmark: l.landmark,
    isDefault: l.isDefault,
  }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-800 tracking-tight">Business Locations</h1>
          <p className="text-xs text-zinc-450 mt-1">Manage your physical store locations and outlets</p>
        </div>
      </div>

      <LocationsClient initialLocations={serialized} canManage={canManage} />
    </div>
  );
}

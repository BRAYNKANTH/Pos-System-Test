import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { redirect } from "next/navigation";
import { isModuleEnabled } from "@/lib/plan";
import { IntegrationsClient } from "./IntegrationsClient";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string; detail?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const allowed = await checkPermission(user.role, PERMISSIONS.ADMIN_MANAGE_ROLES);
  if (!allowed) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-2 px-6 py-16">
        <h1 className="text-xl font-semibold text-zinc-800">Access Denied</h1>
        <p className="text-sm text-zinc-500">You don&apos;t have permission to manage integrations.</p>
      </main>
    );
  }

  // Hidden from the sidebar for deployments without the Zoho add-on (see
  // lib/plan.ts) — this guard is what actually enforces that, since
  // hiding the nav link alone doesn't stop someone reaching the URL
  // directly.
  if (!isModuleEnabled("zoho")) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-2 px-6 py-16">
        <h1 className="text-xl font-semibold text-zinc-800">Not Included in Your Plan</h1>
        <p className="text-sm text-zinc-500">
          Zoho Books integration isn&apos;t part of this deployment. Contact your provider to add it.
        </p>
      </main>
    );
  }

  const { connected, error, detail } = await searchParams;
  const connection = await prisma.zohoConnection.findUnique({ where: { branchId: "default" } });
  const configured = Boolean(process.env.ZOHO_CLIENT_ID && process.env.ZOHO_CLIENT_SECRET);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-6 py-12">
      <h1 className="text-xl font-semibold tracking-tight">Zoho Integration</h1>

      <IntegrationsClient
        configured={configured}
        connection={
          connection
            ? {
                organizationId: connection.organizationId,
                dataCenter: connection.dataCenter,
                expiresAt: connection.expiresAt.toISOString(),
              }
            : null
        }
        connected={connected === "1"}
        error={error}
        detail={detail}
      />
    </main>
  );
}

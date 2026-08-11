import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { ThresholdForm } from "./_ThresholdForm";

export default async function ThresholdsSettingsPage() {
  const user = await getCurrentUser();
  const allowed = user && (await checkPermission(user.role, PERMISSIONS.ADMIN_MANAGE_THRESHOLDS));
  if (!allowed) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-2 px-6 py-16">
        <p className="text-sm text-zinc-500">You don&apos;t have permission to manage thresholds.</p>
      </main>
    );
  }

  const threshold = await prisma.approvalThreshold.findFirst({ where: { scope: "default" } });

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-4 px-6 py-12">
      <h1 className="text-xl font-semibold tracking-tight">Approval Thresholds</h1>
      <p className="text-xs text-zinc-500">
        Inventory adjustments larger than this get held for admin approval instead of
        applying immediately. Read by <code className="font-mono">submitManualAdjustment</code> in{" "}
        <code className="font-mono">lib/inventory/stock.ts</code>.
      </p>
      <ThresholdForm
        initialType={threshold?.thresholdType ?? "absolute"}
        initialValue={threshold ? Number(threshold.value) : 20}
      />
    </main>
  );
}

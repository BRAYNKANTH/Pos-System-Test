import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";

export default async function AuditReportPage({
  searchParams,
}: {
  searchParams: Promise<{ entityType?: string }>;
}) {
  const user = await getCurrentUser();
  const allowed = user && (await checkPermission(user.role, PERMISSIONS.REPORTS_AUDIT_VIEW));
  if (!allowed) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-2 px-6 py-16">
        <p className="text-sm text-zinc-500">You don&apos;t have permission to view the audit report.</p>
      </main>
    );
  }

  const { entityType } = await searchParams;
  const entries = await prisma.auditLog.findMany({
    where: entityType ? { entityType } : undefined,
    orderBy: { timestamp: "desc" },
    take: 100,
    include: { actor: true, approver: true },
  });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-6 py-12">
      <h1 className="text-xl font-semibold tracking-tight">Audit Report</h1>

      <form className="flex gap-2">
        <select
          name="entityType"
          defaultValue={entityType ?? ""}
          className="h-9 rounded-md border border-zinc-200 bg-transparent px-3 text-sm dark:border-zinc-800"
        >
          <option value="">All entity types</option>
          <option value="bill_change_request">Bill change requests</option>
          <option value="stock_adjustment">Stock adjustments</option>
        </select>
      </form>

      <div className="overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-2 font-medium">Entity</th>
              <th className="px-4 py-2 font-medium">Actor</th>
              <th className="px-4 py-2 font-medium">Approver</th>
              <th className="px-4 py-2 font-medium">Reason</th>
              <th className="px-4 py-2 font-medium">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-2">
                  {e.entityType} <span className="text-xs text-zinc-400">{e.entityId}</span>
                </td>
                <td className="px-4 py-2">{e.actor.name}</td>
                <td className="px-4 py-2">{e.approver?.name ?? "—"}</td>
                <td className="px-4 py-2">{e.reason ?? "—"}</td>
                <td className="px-4 py-2 text-xs text-zinc-400">{e.timestamp.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {entries.length === 0 && <p className="p-4 text-sm text-zinc-400">No audit entries yet.</p>}
      </div>
    </main>
  );
}

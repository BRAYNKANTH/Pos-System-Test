import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { isModuleEnabled } from "@/lib/plan";
import { RetryFailedButton } from "./RetryFailedButton";

export default async function SyncStatusPage() {
  // Nothing ever gets queued here for a deployment without the Zoho
  // add-on (enqueueSyncJob no-ops — see lib/plan.ts), so this page would
  // just show an empty table forever. Say why instead of showing that.
  if (!isModuleEnabled("zoho")) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-2 px-6 py-16">
        <h1 className="text-xl font-semibold text-zinc-800">Not Included in Your Plan</h1>
        <p className="text-sm text-zinc-500">
          Zoho Books integration isn&apos;t part of this deployment, so there&apos;s no sync activity to show.
        </p>
      </main>
    );
  }

  const jobs = await prisma.syncQueueJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const counts = {
    pending: jobs.filter((j) => j.status === "pending").length,
    synced: jobs.filter((j) => j.status === "synced").length,
    failed: jobs.filter((j) => j.status === "failed").length,
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-6 py-12">
      <h1 className="text-xl font-semibold tracking-tight">Sync Status</h1>
      <p className="text-xs text-zinc-500">
        Processed by the standalone worker (<code className="font-mono">npm run worker</code>),
        polling every 5s. Without real Zoho credentials configured, jobs will show as{" "}
        <code className="font-mono">failed</code> once retries are exhausted — that&apos;s expected
        and doesn&apos;t block the app.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-4 text-sm">
          <span>
            Pending: <strong>{counts.pending}</strong>
          </span>
          <span>
            Synced: <strong>{counts.synced}</strong>
          </span>
          <span>
            Failed: <strong>{counts.failed}</strong>
          </span>
        </div>
        <RetryFailedButton failedCount={counts.failed} />
      </div>

      <div className="overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-2 font-medium">Entity</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Retries</th>
              <th className="px-4 py-2 font-medium">Last attempt</th>
              <th className="px-4 py-2 font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {jobs.map((job) => (
              <tr key={job.id}>
                <td className="px-4 py-2">
                  {job.entityType} <span className="text-xs text-zinc-400">{job.entityId}</span>
                </td>
                <td className="px-4 py-2">
                  <Badge
                    variant={
                      job.status === "synced"
                        ? "success"
                        : job.status === "failed"
                          ? "destructive"
                          : "warning"
                    }
                  >
                    {job.status}
                  </Badge>
                </td>
                <td className="px-4 py-2">{job.retryCount}</td>
                <td className="px-4 py-2 text-xs text-zinc-400">
                  {job.lastAttemptAt?.toLocaleString() ?? "—"}
                </td>
                <td className="px-4 py-2 text-xs text-zinc-400">
                  {job.createdAt.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

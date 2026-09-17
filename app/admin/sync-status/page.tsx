import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { isModuleEnabled } from "@/lib/plan";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { redirect } from "next/navigation";
import { RetryFailedButton } from "./RetryFailedButton";
import { PullPaymentsButton } from "./PullPaymentsButton";
import { PullProductsButton } from "./PullProductsButton";

export default async function SyncStatusPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Same gate as /admin/settings/integrations — this page was previously
  // reachable by any logged-in user (including cashiers), unlike every
  // other admin/settings screen.
  const allowed = await checkPermission(user.role, PERMISSIONS.ADMIN_MANAGE_ROLES);
  if (!allowed) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-2 px-6 py-16">
        <h1 className="text-xl font-semibold text-zinc-800">Access Denied</h1>
        <p className="text-sm text-zinc-500">You don&apos;t have permission to view sync status.</p>
      </main>
    );
  }

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

  const [jobs, pulledPayments] = await Promise.all([
    prisma.syncQueueJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    // The pull direction leaves its trail as PaymentTender rows tagged
    // "zoho_payment" (see pullInvoicePayments) rather than a SyncQueueJob
    // — those only ever represent the push direction.
    prisma.paymentTender.findMany({
      where: { method: "zoho_payment" },
      orderBy: { id: "desc" },
      take: 20,
      include: { transaction: { select: { id: true, zohoInvoiceId: true } } },
    }),
  ]);

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

      {/* ── Pull direction (Zoho → POS) ──────────────────────────────────
          Everything above this is push (POS → Zoho, one row per
          SyncQueueJob). This is the other way: a payment someone recorded
          directly in Zoho Books against a synced invoice, pulled back so
          the invoice stops showing as due here. Polled — there's no
          webhook wired up (needs a public HTTPS URL Zoho can reach). */}
      <div className="mt-2 rounded-md border border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Payments Pulled from Zoho</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            A payment recorded against a synced invoice directly in Zoho Books (e.g. a bank transfer settling an
            on-account sale) — checked on demand below, and automatically every ~minute by the worker process.
          </p>
        </div>
        <PullPaymentsButton />
        {pulledPayments.length > 0 && (
          <div className="overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800">
           <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="bg-zinc-50 text-left text-xs text-zinc-500 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-2 font-medium">Transaction</th>
                  <th className="px-4 py-2 font-medium">Zoho Invoice</th>
                  <th className="px-4 py-2 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {pulledPayments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2 font-mono text-xs">{p.transactionId.slice(-8)}</td>
                    <td className="px-4 py-2 text-xs text-zinc-400">{p.transaction.zohoInvoiceId ?? "—"}</td>
                    <td className="px-4 py-2 text-right font-mono">Rs {Number(p.amount).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
           </div>
          </div>
        )}
      </div>

      {/* ── Product catalog (Zoho → POS) ─────────────────────────────────
          The one-time/on-demand full pull below is separate from ongoing
          real-time updates — those come from a Zoho Books workflow-rule
          webhook (POST /api/webhooks/zoho/items) firing on item
          create/edit, set up by hand in Zoho's own UI. This button is
          for the initial backfill, or re-syncing on demand later. */}
      <div className="rounded-md border border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Product Catalog</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Zoho Books is the source of truth for the catalog (name, price, category, brand) — new items you add
            in Zoho appear here automatically within moments via a webhook. Use this button for the initial
            import, or to re-sync on demand.
          </p>
        </div>
        <PullProductsButton />
      </div>

      <div className="overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800">
       <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
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
      </div>
    </main>
  );
}

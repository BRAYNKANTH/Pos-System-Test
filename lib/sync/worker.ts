import { prisma } from "@/lib/prisma";
import { sendToZoho } from "./zohoClient";

const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 2000;

/** retryWithBackoff — exponential backoff on failure (HTTP 429 or any
 * other error): 2s, 4s, 8s, 16s, 32s, capped. A job isn't picked up again
 * until its backoff window has elapsed. */
function nextRetryDue(retryCount: number, lastAttemptAt: Date | null): boolean {
  if (!lastAttemptAt) return true;
  const backoff = Math.min(BASE_BACKOFF_MS * 2 ** retryCount, 5 * 60 * 1000);
  return Date.now() - lastAttemptAt.getTime() >= backoff;
}

/** processSyncQueue — one pass over pending/retryable jobs. Run on an
 * interval by scripts/worker.ts (`npm run worker`), a separate process
 * from the Next.js server since this isn't part of the request lifecycle. */
export async function processSyncQueue() {
  const candidates = await prisma.syncQueueJob.findMany({
    where: { status: { in: ["pending", "failed"] }, retryCount: { lt: MAX_RETRIES } },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  const due = candidates.filter((job) => nextRetryDue(job.retryCount, job.lastAttemptAt));

  let processed = 0;
  for (const job of due) {
    processed++;
    try {
      await sendToZoho({
        entityType: job.entityType as "transaction" | "bill" | "stock_adjustment" | "customer",
        entityId: job.entityId,
        idempotencyKey: job.id, // applyIdempotencyKey — job id is stable across retries
      });
      await prisma.syncQueueJob.update({
        where: { id: job.id },
        data: { status: "synced", lastAttemptAt: new Date() },
      });
    } catch (err) {
      const retryCount = job.retryCount + 1;
      await prisma.syncQueueJob.update({
        where: { id: job.id },
        data: {
          status: retryCount >= MAX_RETRIES ? "failed" : "pending",
          retryCount,
          lastAttemptAt: new Date(),
        },
      });
      console.error(`sync job ${job.id} (${job.entityType}) failed:`, (err as Error).message);
    }
  }

  return { checked: candidates.length, processed };
}

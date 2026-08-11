import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// Called by Modules 1-3 whenever something needs to reach Zoho, always
// AFTER the caller's own DB transaction (checkout, approval, etc.) has
// already committed — enqueueing a sync job is a separate, independent
// step, not part of that transaction.
//
// DB-only queue (no Redis/BullMQ) — the `sync_queue` table IS the queue.
// A polling worker (lib/sync/worker.ts, run via `npm run worker`) picks up
// `status: "pending"` rows on an interval. This is simpler to run (no
// extra service to install) at the cost of a few seconds of latency
// versus a push-based queue, which is a fine trade-off for background
// Zoho sync.

export type SyncEntityType = "transaction" | "bill" | "stock_adjustment" | "customer";

// `payload` is stored for debugging/audit only — sendToZoho (zohoClient.ts)
// re-fetches the real record fresh from the DB via `entityId` at send time
// rather than trusting this snapshot, so it stays correct even if the
// record changes between enqueueing and an eventual retry.
export async function enqueueSyncJob(params: {
  entityType: SyncEntityType;
  entityId: string;
  payload: unknown;
}) {
  return prisma.syncQueueJob.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      payload: params.payload as Prisma.InputJsonValue,
      status: "pending",
    },
  });
}

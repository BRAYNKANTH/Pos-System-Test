"use client";

import { offlineDB, type OfflinePayload } from "./db";

/** queueOfflineTransaction — stores a checkout locally when
 * /api/pos/checkout can't be reached at all (offline). */
export async function queueOfflineTransaction(idempotencyKey: string, payload: OfflinePayload) {
  if (!offlineDB) return;
  await offlineDB.pendingTransactions.add({ idempotencyKey, payload, createdAt: Date.now() });
}

export async function getPendingCount(): Promise<number> {
  if (!offlineDB) return 0;
  return offlineDB.pendingTransactions.count();
}

/** syncOnReconnect — flushes the offline queue in original order once
 * connectivity returns. Each request reuses its original idempotencyKey,
 * so if the same one somehow already reached the server (edge case: the
 * request actually succeeded but the response never arrived), it just
 * gets the original result back instead of double-selling. */
export async function syncOnReconnect(): Promise<{ synced: number; failed: number }> {
  if (!offlineDB) return { synced: 0, failed: 0 };

  const pending = await offlineDB.pendingTransactions.orderBy("createdAt").toArray();
  let synced = 0;
  let failed = 0;

  for (const tx of pending) {
    try {
      const res = await fetch("/api/pos/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...tx.payload, idempotencyKey: tx.idempotencyKey }),
      });
      const body = await res.json();
      if (body.success) {
        await offlineDB.pendingTransactions.delete(tx.id!);
        synced++;
      } else {
        failed++;
      }
    } catch {
      // still offline or server unreachable — stop, try again next time
      failed++;
      break;
    }
  }

  return { synced, failed };
}

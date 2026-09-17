"use client";
import { offlineDB, type OfflinePayload } from "./db";
let running: Promise<{ synced: number; failed: number }> | null = null;
export function queueChanged() { window.dispatchEvent(new Event('pos-queue-changed')); }
export async function queueOfflineTransaction(idempotencyKey: string, payload: OfflinePayload) {
  if (!offlineDB) throw new Error('Offline storage unavailable');
  const ownerId = sessionStorage.getItem('pos-user');
  if (!ownerId) throw new Error('Sign in before recording an offline sale');
  const existing = await offlineDB.pendingTransactions.where('idempotencyKey').equals(idempotencyKey).first();
  if (!existing) await offlineDB.pendingTransactions.add({ idempotencyKey, payload: { ...payload, offlineCashierId: ownerId }, ownerId, createdAt: Date.now() });
  queueChanged();
}
export async function getPendingTransactions() {
  if (!offlineDB) return [];
  const ownerId = sessionStorage.getItem('pos-user');
  return (await offlineDB.pendingTransactions.orderBy('createdAt').toArray()).filter(t => t.ownerId === ownerId || !t.ownerId);
}
export async function getPendingCount() { return (await getPendingTransactions()).length; }
export function syncOnReconnect(): Promise<{ synced: number; failed: number }> {
  if (running) return running;
  running = flush().finally(() => { running = null; queueChanged(); });
  return running;
}
async function flush() {
  let synced = 0, failed = 0;
  if (!offlineDB) return { synced, failed };
  const ownerId = sessionStorage.getItem('pos-user');
  for (const tx of await getPendingTransactions()) {
    if (!tx.ownerId || tx.ownerId !== ownerId) {
      await offlineDB.pendingTransactions.update(tx.id!, { lastError: 'Legacy sale: cashier identity is missing. Export for manager reconciliation.' }); failed++; continue;
    }
    try {
      const res = await fetch('/api/pos/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...tx.payload, idempotencyKey: tx.idempotencyKey }) });
      const body = await res.json();
      if (res.ok && body.success) { await offlineDB.pendingTransactions.delete(tx.id!); synced++; }
      else { failed++; await offlineDB.pendingTransactions.update(tx.id!, { lastError: body.error?.message ?? 'Sale could not be synchronized' }); if (res.status === 401) break; }
    } catch { failed++; await offlineDB.pendingTransactions.update(tx.id!, { lastError: 'Connection interrupted. Safe to retry.' }); break; }
  }
  if (synced) window.dispatchEvent(new Event('pos-stock-changed'));
  return { synced, failed };
}

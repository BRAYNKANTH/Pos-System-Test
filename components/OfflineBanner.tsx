"use client";
import { useCallback, useEffect, useState } from "react";
import { getPendingTransactions, syncOnReconnect } from "@/lib/offline/sync";
import type { OfflineTransaction } from "@/lib/offline/db";
export function OfflineBanner() {
  const [offline, setOffline] = useState(false); const [pending, setPending] = useState<OfflineTransaction[]>([]);
  const [syncing, setSyncing] = useState(false); const [storageError, setStorageError] = useState('');
  const refresh = useCallback(() => { void getPendingTransactions().then(setPending).catch(() => setStorageError('Browser storage is unavailable. Keep this tab open until your sale is saved.')); }, []);
  const sync = useCallback(async () => { setSyncing(true); try { await syncOnReconnect(); } catch { setStorageError("Synchronization failed. Retry when the connection is restored."); } finally { setSyncing(false); refresh(); } }, [refresh]);
  useEffect(() => {
    setOffline(!navigator.onLine); refresh();
    const onOffline = () => setOffline(true);
    const onOnline = () => { setOffline(false); void sync(); };
    const recoveryError = () => setStorageError('Automatic cart recovery could not save. Hold the sale before closing this tab.');
    window.addEventListener('online', onOnline); window.addEventListener('offline', onOffline);
    window.addEventListener('pos-queue-changed', refresh); window.addEventListener('pos-recovery-error', recoveryError);
    const timer = setInterval(refresh, 10000);
    return () => { clearInterval(timer); window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); window.removeEventListener('pos-queue-changed', refresh); window.removeEventListener('pos-recovery-error', recoveryError); };
  }, [refresh, sync]);
  if (!offline && !pending.length && !storageError) return null;
  return <aside className="border-b border-amber-400 bg-amber-50 px-4 py-3 text-amber-950" aria-label="Connection and pending sales">
    <p role="status">{storageError || (offline ? 'Offline. Sales will remain pending until synchronized.' : syncing ? 'Synchronizing sales...' : pending.length + ' sales awaiting synchronization.')}</p>
    {!!pending.length && <details><summary className="cursor-pointer py-2">Review pending sales</summary>
      <ul>{pending.map(t => <li key={t.id} className="py-2">{new Date(t.createdAt).toLocaleString()} - {t.payload.items.length} lines ? {t.lastError || 'Pending'}</li>)}</ul>
      <button disabled={offline || syncing} onClick={() => void sync()} className="mr-3 rounded border px-3 py-2">Retry synchronization</button>
      <button className="rounded border px-3 py-2" onClick={() => {
        const url = URL.createObjectURL(new Blob([JSON.stringify(pending, null, 2)], { type: 'application/json' }));
        const link = document.createElement('a'); link.href = url; link.download = 'pending-pos-sales.json'; link.click(); URL.revokeObjectURL(url);
      }}>Export for reconciliation</button>
    </details>}
  </aside>;
}

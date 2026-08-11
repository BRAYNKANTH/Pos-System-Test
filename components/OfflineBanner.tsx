"use client";

import { useEffect, useState } from "react";
import { syncOnReconnect, getPendingCount } from "@/lib/offline/sync";

// Global offline indicator + reconnect flush. Full offline-queue storage
// lives in lib/offline/db.ts (Dexie/IndexedDB) — this component reflects
// browser connectivity state and triggers syncOnReconnect when the
// browser comes back online.
export function OfflineBanner() {
  // Lazy initializer instead of setState-in-effect: `navigator` isn't
  // available during SSR, so this always resolves to `false` on the
  // server and syncs to the real value on the client's first render.
  const [isOffline, setIsOffline] = useState(
    () => typeof navigator !== "undefined" && !navigator.onLine,
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    getPendingCount().then(setPendingCount);

    const goOffline = () => setIsOffline(true);
    const goOnline = () => {
      setIsOffline(false);
      setSyncing(true);
      syncOnReconnect()
        .then(() => getPendingCount())
        .then(setPendingCount)
        .finally(() => setSyncing(false));
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  // Return null unconditionally to completely remove the yellow offline banner from the UI
  // while keeping the window "online" event listeners active in the background to trigger syncs.
  return null;
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function RetryFailedButton({ failedCount }: { failedCount: number }) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleRetry() {
    setRetrying(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/sync-status/retry", { method: "POST" });
      const body = await res.json();
      if (body.success) {
        setMsg(`Reset ${body.data.reset} job(s) — the worker will retry them within ~5s.`);
        router.refresh();
      } else {
        setMsg(body.error?.message ?? "Failed to reset jobs");
      }
    } finally {
      setRetrying(false);
    }
  }

  if (failedCount === 0) return null;

  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" size="sm" onClick={handleRetry} disabled={retrying}>
        {retrying ? "Retrying..." : `Retry ${failedCount} failed job(s)`}
      </Button>
      {msg && <span className="text-xs text-zinc-500">{msg}</span>}
    </div>
  );
}

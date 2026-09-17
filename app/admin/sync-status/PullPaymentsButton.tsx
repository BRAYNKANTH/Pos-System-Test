"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

// The one "Zoho → POS" direction of the sync — see pullInvoicePayments'
// docs in lib/sync/zohoClient.ts. Everything else on this page is the
// other direction (POS → Zoho, via the SyncQueue jobs table below).
export function PullPaymentsButton() {
  const router = useRouter();
  const [pulling, setPulling] = useState(false);
  const [msg, setMsg] = useState("");

  async function handlePull() {
    setPulling(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/sync/pull-payments", { method: "POST" });
      const body = await res.json();
      if (body.success) {
        const { checked, updated, errors } = body.data;
        setMsg(
          `Checked ${checked} still-due invoice(s), recorded ${updated} new payment(s)` +
            (errors.length > 0 ? ` — ${errors.length} error(s), see server log` : ""),
        );
        if (updated > 0) router.refresh();
      } else {
        setMsg(body.error?.message ?? "Failed to pull payments");
      }
    } finally {
      setPulling(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" size="sm" onClick={handlePull} disabled={pulling}>
        {pulling ? "Checking Zoho…" : "Pull Payments from Zoho"}
      </Button>
      {msg && <span className="text-xs text-zinc-500">{msg}</span>}
    </div>
  );
}

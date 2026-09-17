"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

// One-time/on-demand full catalog reconciliation against Zoho Books —
// see pullAllProductsFromZoho's docs in lib/sync/zohoClient.ts. Ongoing,
// real-time updates after this come from the item webhook instead (see
// app/api/webhooks/zoho/items/route.ts), not from re-running this.
export function PullProductsButton() {
  const router = useRouter();
  const [pulling, setPulling] = useState(false);
  const [msg, setMsg] = useState("");

  async function handlePull() {
    if (!window.confirm("Import the full product catalog from Zoho Books? Local products not found in Zoho will be removed.")) {
      return;
    }
    setPulling(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/sync/pull-products", { method: "POST" });
      const body = await res.json();
      if (body.success) {
        const { created, updated, removed, errors, pagesFetched, stoppedEarly } = body.data;
        setMsg(
          `Created ${created}, updated ${updated}, removed ${removed} (${pagesFetched} page(s) fetched)` +
            (stoppedEarly ? " — stopped early, see errors below" : "") +
            (errors.length > 0 ? ` — ${errors.length} error(s): ${errors[0].message}` : ""),
        );
        router.refresh();
      } else {
        setMsg(body.error?.message ?? "Failed to import products");
      }
    } finally {
      setPulling(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" size="sm" onClick={handlePull} disabled={pulling}>
        {pulling ? "Importing…" : "Import Products from Zoho"}
      </Button>
      {msg && <span className="text-xs text-zinc-500">{msg}</span>}
    </div>
  );
}

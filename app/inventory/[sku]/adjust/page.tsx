"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const REASONS = ["stock_take", "damage", "spoilage", "correction", "theft", "other"];

export default function AdjustPage({ params }: { params: Promise<{ sku: string }> }) {
  const { sku } = use(params);
  const router = useRouter();
  const [qtyChange, setQtyChange] = useState("");
  const [reasonCategory, setReasonCategory] = useState(REASONS[0]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/inventory/${sku}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qtyChange: Number(qtyChange), reasonCategory }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Failed to submit adjustment");
        return;
      }
      if (body.data.status === "pending") {
        setMessage("Over threshold — submitted for admin approval.");
      } else {
        setMessage("Adjustment applied.");
        router.push(`/inventory/${sku}`);
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-4 px-6 py-12">
      <h1 className="text-xl font-semibold tracking-tight">Adjust {sku}</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Quantity change</label>
          <input
            type="number"
            required
            placeholder="e.g. -5 for damage, +10 for a stock take correction"
            value={qtyChange}
            onChange={(e) => setQtyChange(e.target.value)}
            className="h-9 rounded-md border border-zinc-200 bg-transparent px-3 text-sm outline-none dark:border-zinc-800"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Reason</label>
          <select
            value={reasonCategory}
            onChange={(e) => setReasonCategory(e.target.value)}
            className="h-9 rounded-md border border-zinc-200 bg-transparent px-3 text-sm dark:border-zinc-800"
          >
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {r.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && <p className="text-sm text-green-600">{message}</p>}
        <Button type="submit" disabled={submitting || !qtyChange}>
          {submitting ? "Submitting…" : "Submit adjustment"}
        </Button>
      </form>
    </main>
  );
}

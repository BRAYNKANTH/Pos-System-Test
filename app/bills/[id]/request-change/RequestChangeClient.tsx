"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const TYPES = ["correction", "refund", "void"] as const;

export function RequestChangeClient({ id }: { id: string }) {
  const router = useRouter();
  const [type, setType] = useState<(typeof TYPES)[number]>("correction");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/bills/${id}/request-change`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, reason, proposedChanges: { description } }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Failed to submit request");
        return;
      }
      router.push("/bills/requests");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-4 px-6 py-12">
      <h1 className="text-xl font-semibold tracking-tight">Request a change</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as (typeof TYPES)[number])}
            className="h-9 rounded-md border border-zinc-200 bg-transparent px-3 text-sm dark:border-zinc-800"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Reason</label>
          <input
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Customer returned item, wrong qty rung up"
            className="h-9 rounded-md border border-zinc-200 bg-transparent px-3 text-sm outline-none focus:border-indigo-500 dark:border-zinc-800"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Proposed change</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe exactly what should change (item, qty, amount)"
            className="h-24 rounded-md border border-zinc-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-zinc-800"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={submitting || !reason}>
          {submitting ? "Submitting…" : "Submit request"}
        </Button>
      </form>
    </main>
  );
}

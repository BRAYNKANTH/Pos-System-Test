"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type CreditNote = {
  id: string;
  amount: number;
  remainingAmount: number;
  status: string;
  reason: string | null;
  sourceTransactionId: string | null;
  createdAt: string;
};

const fmt = (val: number) => `Rs ${val.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function CreditNotesPanel({
  customerId,
  availableBalance,
  creditNotes,
  canManage,
}: {
  customerId: string;
  availableBalance: number;
  creditNotes: CreditNote[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [issuing, setIssuing] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleIssue(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    if (!reason.trim()) {
      setError("A reason is required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/customers/${customerId}/store-credits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt, reason: reason.trim() }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Failed to issue credit note");
        return;
      }
      setAmount("");
      setReason("");
      setIssuing(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVoid(creditId: string) {
    if (!confirm("Void the unused remainder of this credit note? This can't be undone.")) return;
    setVoidingId(creditId);
    try {
      await fetch(`/api/customers/${customerId}/store-credits/${creditId}/void`, { method: "POST" });
      router.refresh();
    } finally {
      setVoidingId(null);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between p-4 border-b border-zinc-150 dark:border-zinc-800">
        <div>
          <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-1.5">
            🧾 Credit Notes
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Available balance: <span className="font-bold text-emerald-600">{fmt(availableBalance)}</span>
          </p>
        </div>
        {canManage && (
          <Button size="sm" variant="outline" onClick={() => setIssuing((v) => !v)}>
            {issuing ? "Cancel" : "+ Issue Credit"}
          </Button>
        )}
      </div>

      {issuing && (
        <form onSubmit={handleIssue} className="p-4 border-b border-zinc-150 dark:border-zinc-800 space-y-2 bg-zinc-50/60 dark:bg-zinc-900/40">
          {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Amount (Rs)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-9 w-32 rounded border border-zinc-300 px-2 text-sm font-mono outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-850"
            />
            <input
              type="text"
              placeholder="Reason (e.g. goodwill adjustment)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-9 flex-1 rounded border border-zinc-300 px-2 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-850"
            />
          </div>
          <Button type="submit" size="sm" disabled={submitting}>
            {submitting ? "Issuing…" : "Issue Credit Note"}
          </Button>
        </form>
      )}

      <div className="flex flex-col divide-y divide-zinc-150 dark:divide-zinc-800">
        {creditNotes.length === 0 && (
          <p className="p-4 text-sm text-zinc-400">No credit notes yet.</p>
        )}
        {creditNotes.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3 p-3 text-sm">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-zinc-800 dark:text-zinc-100">{fmt(c.remainingAmount)}</span>
                {c.remainingAmount !== c.amount && (
                  <span className="text-xs text-zinc-400">of {fmt(c.amount)}</span>
                )}
                <Badge
                  variant={c.status === "active" ? "success" : c.status === "void" ? "destructive" : "default"}
                >
                  {c.status}
                </Badge>
              </div>
              <p className="text-xs text-zinc-500 truncate mt-0.5">
                {c.reason ?? "—"}
                {c.sourceTransactionId && (
                  <>
                    {" · from sale "}
                    <span className="font-mono">{c.sourceTransactionId.slice(-8)}</span>
                  </>
                )}
              </p>
              <p className="text-[11px] text-zinc-400">{new Date(c.createdAt).toLocaleString()}</p>
            </div>
            {canManage && c.status === "active" && (
              <button
                onClick={() => handleVoid(c.id)}
                disabled={voidingId === c.id}
                className="shrink-0 text-xs font-bold text-red-600 hover:underline disabled:opacity-50"
              >
                {voidingId === c.id ? "Voiding…" : "Void"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

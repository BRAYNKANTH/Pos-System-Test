"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";

type EditableLine = {
  id: string;
  sku: string;
  qty: number;
  unitPrice: number;
  discount: number;
  batchNumber: string | null;
  serialNumbers: unknown;
};

const currencyFmt = (val: number) => `Rs ${val.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Admin-only direct correction of a locked invoice's line items — see
// lib/bills/editInvoice.ts for what this can and can't touch (no
// batch/serial lines, no adding a new SKU). Gated the same way
// VoidSaleButton is: a fresh password re-auth right before the action,
// not just being logged in as an admin.
export function EditInvoiceButton({ billId, items }: { billId: string; items: EditableLine[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"password" | "edit">("password");
  const [password, setPassword] = useState("");
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function openModal() {
    setStep("password");
    setPassword("");
    setLines(items.map((i) => ({ ...i })));
    setRemovedIds(new Set());
    setReason("");
    setError(null);
    setOpen(true);
  }

  function close() {
    setOpen(false);
  }

  async function handleUnlock() {
    if (!password) {
      setError("Password is required");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/admin-reauth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Incorrect password");
        return;
      }
      setStep("edit");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function updateLine(id: string, patch: Partial<EditableLine>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function toggleRemove(id: string) {
    setRemovedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const isTracked = (l: EditableLine) => !!l.batchNumber || (Array.isArray(l.serialNumbers) && l.serialNumbers.length > 0);
  const keptLines = lines.filter((l) => !removedIds.has(l.id));
  const newTotal = keptLines.reduce((sum, l) => sum + Math.max(0, l.qty * l.unitPrice - l.discount), 0);

  async function handleSave() {
    if (!reason.trim()) {
      setError("A reason is required");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/bills/${billId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reason.trim(),
          updates: lines
            .filter((l) => !removedIds.has(l.id))
            .map((l) => ({ id: l.id, qty: l.qty, unitPrice: l.unitPrice, discount: l.discount })),
          removeIds: [...removedIds],
        }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Failed to save changes");
        return;
      }
      close();
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        onClick={openModal}
        className="bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-200 px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
      >
        <Pencil className="h-3.5 w-3.5 text-indigo-600" /> Edit Invoice
      </button>

      <Modal open={open} onClose={close} title={step === "password" ? "Confirm Your Password" : "Edit Invoice"} closeDisabled={submitting}>
        {step === "password" ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-zinc-500">
              Editing a locked invoice rewrites its recorded total and adjusts stock. Re-enter your password to continue.
            </p>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="h-9 rounded-md border border-zinc-200 bg-transparent px-3 text-sm outline-none dark:border-zinc-800"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button onClick={handleUnlock} disabled={submitting}>
                {submitting ? "Checking…" : "Continue"}
              </Button>
              <Button variant="outline" onClick={close} disabled={submitting}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-150 dark:divide-zinc-800 max-h-80 overflow-y-auto">
              {lines.map((l) => {
                const removed = removedIds.has(l.id);
                const tracked = isTracked(l);
                return (
                  <div key={l.id} className={`p-3 flex items-center gap-2.5 ${removed ? "opacity-40" : ""}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 truncate">
                        {l.sku}
                        {tracked && <span className="ml-1.5 text-[11px] font-normal text-amber-600">(not editable — tracked)</span>}
                      </p>
                    </div>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      disabled={removed || tracked}
                      value={l.qty}
                      onChange={(e) => updateLine(l.id, { qty: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="h-8 w-16 rounded border border-zinc-300 px-2 text-xs font-mono text-center outline-none focus:border-indigo-500 disabled:bg-zinc-100 dark:disabled:bg-zinc-800"
                      title="Quantity"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      disabled={removed || tracked}
                      value={l.unitPrice}
                      onChange={(e) => updateLine(l.id, { unitPrice: Math.max(0, parseFloat(e.target.value) || 0) })}
                      className="h-8 w-24 rounded border border-zinc-300 px-2 text-xs font-mono text-right outline-none focus:border-indigo-500 disabled:bg-zinc-100 dark:disabled:bg-zinc-800"
                      title="Unit price"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      disabled={removed || tracked}
                      value={l.discount}
                      onChange={(e) => updateLine(l.id, { discount: Math.max(0, parseFloat(e.target.value) || 0) })}
                      className="h-8 w-20 rounded border border-zinc-300 px-2 text-xs font-mono text-right outline-none focus:border-indigo-500 disabled:bg-zinc-100 dark:disabled:bg-zinc-800"
                      title="Discount (Rs)"
                    />
                    {!tracked && (
                      <button
                        type="button"
                        onClick={() => toggleRemove(l.id)}
                        className={`h-8 w-8 rounded flex items-center justify-center transition ${
                          removed ? "bg-zinc-200 text-zinc-500" : "bg-red-50 text-red-600 hover:bg-red-100"
                        }`}
                        title={removed ? "Undo remove" : "Remove line"}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between text-sm font-bold text-zinc-800 dark:text-zinc-200 border-t border-zinc-150 dark:border-zinc-800 pt-3">
              <span>New subtotal (before tax/shipping)</span>
              <span className="font-mono">{currencyFmt(newTotal)}</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-650 mb-1">Reason for this edit *</label>
              <input
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Cashier rang up the wrong quantity"
                className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={submitting || keptLines.length === 0}>
                {submitting ? "Saving…" : "Save Changes"}
              </Button>
              <Button variant="outline" onClick={close} disabled={submitting}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

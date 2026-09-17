"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Batch = {
  batchNumber: string;
  qtyOnHand: number;
  costPrice: number | null;
  unitPrice: number | null;
  expiryDate: string | null; // yyyy-mm-dd
};

function expiryStatus(expiryDate: string | null): { label: string; variant: "success" | "warning" | "destructive" } | null {
  if (!expiryDate) return null;
  const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { label: "Expired", variant: "destructive" };
  if (days <= 60) return { label: "Near expiry", variant: "warning" };
  return { label: "Good", variant: "success" };
}

// Direct batch/lot maintenance for a batch-tracked product — view every
// lot (not just the in-stock ones the POS picker shows), correct a
// count, fix a price or expiry typo, or bring in a new lot manually
// (outside of a goods-receipt purchase order). See
// app/api/inventory/[sku]/batches/route.ts and .../[batchNumber]/route.ts.
export function BatchesPanel({ sku, batches }: { sku: string; batches: Batch[] }) {
  const router = useRouter();
  // Rendered straight from the `batches` prop rather than copied into
  // useState — this is a server component's data, refreshed via
  // router.refresh() after every add/edit below; copying it into
  // useState once at mount would go stale on every refresh after the
  // first; that's what a prior version of this did (an add/edit
  // succeeded and the item's real qtyOnHand updated, but the visible
  // list here just kept showing what was on screen before the change
  // until a full page reload).
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Batch | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Add form state
  const [newBatchNumber, setNewBatchNumber] = useState("");
  const [newQty, setNewQty] = useState("");
  const [newExpiry, setNewExpiry] = useState("");
  const [newCostPrice, setNewCostPrice] = useState("");
  const [newUnitPrice, setNewUnitPrice] = useState("");

  // Edit form state
  const [editQty, setEditQty] = useState("");
  const [editCostPrice, setEditCostPrice] = useState("");
  const [editUnitPrice, setEditUnitPrice] = useState("");
  const [editExpiry, setEditExpiry] = useState("");

  function openAdd() {
    setNewBatchNumber("");
    setNewQty("");
    setNewExpiry("");
    setNewCostPrice("");
    setNewUnitPrice("");
    setError("");
    setAddOpen(true);
  }

  function openEdit(b: Batch) {
    setEditing(b);
    setEditQty(String(b.qtyOnHand));
    setEditCostPrice(b.costPrice !== null ? String(b.costPrice) : "");
    setEditUnitPrice(b.unitPrice !== null ? String(b.unitPrice) : "");
    setEditExpiry(b.expiryDate ?? "");
    setError("");
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newBatchNumber.trim() || !newQty || Number(newQty) <= 0) {
      setError("Batch number and a positive quantity are required.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/inventory/${encodeURIComponent(sku)}/batches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchNumber: newBatchNumber.trim(),
          qty: Number(newQty),
          expiryDate: newExpiry || undefined,
          costPrice: newCostPrice || undefined,
          unitPrice: newUnitPrice || undefined,
        }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Failed to add batch");
        return;
      }
      setAddOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEditSave() {
    if (!editing) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/inventory/${encodeURIComponent(sku)}/batches/${encodeURIComponent(editing.batchNumber)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qtyOnHand: Number(editQty),
          costPrice: editCostPrice ? Number(editCostPrice) : null,
          unitPrice: editUnitPrice ? Number(editUnitPrice) : null,
          expiryDate: editExpiry || null,
        }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Failed to update batch");
        return;
      }
      setEditing(null);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  const totalQty = batches.reduce((sum, b) => sum + b.qtyOnHand, 0);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Batches / Lots <span className="text-xs font-normal text-zinc-400">({totalQty} total on hand across {batches.length} lot{batches.length === 1 ? "" : "s"})</span></h2>
        <Button size="sm" variant="outline" onClick={openAdd}>+ Add Batch</Button>
      </div>
      <div className="flex flex-col divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {batches.length === 0 && <p className="p-4 text-sm text-zinc-400">No batches recorded yet.</p>}
        {batches.map((b) => {
          const status = expiryStatus(b.expiryDate);
          return (
            <div key={b.batchNumber} className="flex items-center justify-between gap-2 p-3 text-sm">
              <div className="min-w-0">
                <p className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                  {b.batchNumber}
                  {status && (
                    <Badge variant={status.variant} className="ml-2">
                      {status.label}
                    </Badge>
                  )}
                </p>
                <p className="text-xs text-zinc-450 mt-0.5">
                  {b.qtyOnHand} on hand
                  {b.costPrice !== null && ` · Cost Rs ${b.costPrice.toFixed(2)}`}
                  {b.unitPrice !== null ? ` · Sells at Rs ${b.unitPrice.toFixed(2)}` : " · Catalog price"}
                  {b.expiryDate && ` · Expires ${b.expiryDate}`}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => openEdit(b)}>
                Edit
              </Button>
            </div>
          );
        })}
      </div>

      {/* Add batch modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Batch / Lot" closeDisabled={submitting}>
        <form onSubmit={handleAdd} className="space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div>
            <label className="block text-xs font-bold text-zinc-650 mb-1">Batch / Lot Number *</label>
            <input
              required
              value={newBatchNumber}
              onChange={(e) => setNewBatchNumber(e.target.value)}
              className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-zinc-650 mb-1">Quantity *</label>
              <input
                type="number"
                min="1"
                required
                value={newQty}
                onChange={(e) => setNewQty(e.target.value)}
                className="h-9 w-full rounded border border-zinc-300 px-3 text-sm font-mono outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-650 mb-1">Expiry Date</label>
              <input
                type="date"
                value={newExpiry}
                onChange={(e) => setNewExpiry(e.target.value)}
                className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-650 mb-1">Cost Price (Rs)</label>
              <input
                type="number"
                step="0.01"
                value={newCostPrice}
                onChange={(e) => setNewCostPrice(e.target.value)}
                className="h-9 w-full rounded border border-zinc-300 px-3 text-sm font-mono outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-650 mb-1">Selling Price (Rs)</label>
              <input
                type="number"
                step="0.01"
                placeholder="Leave blank to use catalog price"
                value={newUnitPrice}
                onChange={(e) => setNewUnitPrice(e.target.value)}
                className="h-9 w-full rounded border border-zinc-300 px-3 text-sm font-mono outline-none focus:border-indigo-500"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Add Batch"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)} disabled={submitting}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit batch modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Edit Batch — ${editing.batchNumber}` : undefined} closeDisabled={submitting}>
        {editing && (
          <div className="space-y-3">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-zinc-650 mb-1">Quantity on Hand</label>
                <input
                  type="number"
                  min="0"
                  value={editQty}
                  onChange={(e) => setEditQty(e.target.value)}
                  className="h-9 w-full rounded border border-zinc-300 px-3 text-sm font-mono outline-none focus:border-indigo-500"
                />
                <p className="text-[11px] text-zinc-400 mt-1">Changing this also adjusts the product's total stock and logs a correction.</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-650 mb-1">Expiry Date</label>
                <input
                  type="date"
                  value={editExpiry}
                  onChange={(e) => setEditExpiry(e.target.value)}
                  className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-650 mb-1">Cost Price (Rs)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editCostPrice}
                  onChange={(e) => setEditCostPrice(e.target.value)}
                  className="h-9 w-full rounded border border-zinc-300 px-3 text-sm font-mono outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-650 mb-1">Selling Price (Rs)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Blank = catalog price"
                  value={editUnitPrice}
                  onChange={(e) => setEditUnitPrice(e.target.value)}
                  className="h-9 w-full rounded border border-zinc-300 px-3 text-sm font-mono outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={handleEditSave} disabled={submitting}>
                {submitting ? "Saving…" : "Save Changes"}
              </Button>
              <Button variant="outline" onClick={() => setEditing(null)} disabled={submitting}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

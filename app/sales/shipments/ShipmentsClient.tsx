"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Truck } from "lucide-react";

type ShipmentRow = {
  id: string;
  transactionId: string;
  customerName: string;
  carrier: string | null;
  trackingNumber: string | null;
  status: string;
  createdAt: string;
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  shipped: "bg-blue-50 text-blue-700",
  delivered: "bg-green-50 text-green-700",
};

export function ShipmentsClient({ initialShipments }: { initialShipments: ShipmentRow[] }) {
  const router = useRouter();
  const [shipments, setShipments] = useState(initialShipments);
  const [modalOpen, setModalOpen] = useState(false);
  const [txId, setTxId] = useState("");
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function openModal() {
    setTxId("");
    setCarrier("");
    setTrackingNumber("");
    setError("");
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/sales/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: txId.trim(), carrier: carrier || undefined, trackingNumber: trackingNumber || undefined }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Failed to create shipment");
        return;
      }
      setModalOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/sales/shipments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const body = await res.json();
    if (body.success) {
      setShipments((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
    } else {
      alert(body.error?.message ?? "Failed to update shipment");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-zinc-800 tracking-tight flex items-center gap-2">
            <Truck className="h-6 w-6 text-indigo-650" /> Shipments
          </h1>
          <p className="text-xs text-zinc-450 mt-1">Delivery tracking for sales that need to be fulfilled after checkout.</p>
        </div>
        <button
          onClick={openModal}
          className="bg-indigo-650 hover:bg-indigo-750 text-white px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="h-4 w-4" /> Add Shipment
        </button>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-lg border border-zinc-200 shadow-xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm text-zinc-800">Add Shipment</h3>
              <button onClick={() => setModalOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-650 mb-1">Transaction / Invoice ID *</label>
                <input
                  required
                  autoFocus
                  value={txId}
                  onChange={(e) => setTxId(e.target.value)}
                  placeholder="From the receipt or All Sales"
                  className="h-9 w-full rounded border border-zinc-300 px-3 text-sm font-mono outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-650 mb-1">Carrier</label>
                <input
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  placeholder="e.g. Domex, Pronto"
                  className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-650 mb-1">Tracking Number</label>
                <input
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  className="h-9 w-full rounded border border-zinc-300 px-3 text-sm font-mono outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex justify-end gap-2 border-t pt-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3.5 py-1.5 rounded border text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold shadow-sm transition disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-50 text-zinc-650 font-bold border-b border-zinc-150 uppercase tracking-wider text-xs">
              <tr>
                <th className="px-4 py-3.5">Date</th>
                <th className="px-4 py-3.5">Transaction</th>
                <th className="px-4 py-3.5">Customer</th>
                <th className="px-4 py-3.5">Carrier</th>
                <th className="px-4 py-3.5">Tracking No.</th>
                <th className="px-4 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-sm">
              {shipments.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-400">No shipments recorded yet.</td>
                </tr>
              )}
              {shipments.map((s) => (
                <tr key={s.id} className="hover:bg-zinc-50/50 transition">
                  <td className="px-4 py-3.5 text-zinc-600">{s.createdAt}</td>
                  <td className="px-4 py-3.5 font-mono text-zinc-500 text-[11px]">{s.transactionId.slice(0, 12)}…</td>
                  <td className="px-4 py-3.5 font-bold text-zinc-800">{s.customerName}</td>
                  <td className="px-4 py-3.5 text-zinc-600">{s.carrier ?? "—"}</td>
                  <td className="px-4 py-3.5 font-mono text-zinc-600">{s.trackingNumber ?? "—"}</td>
                  <td className="px-4 py-3.5">
                    <select
                      value={s.status}
                      onChange={(e) => updateStatus(s.id, e.target.value)}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold capitalize border-0 outline-none ${STATUS_STYLES[s.status] ?? "bg-zinc-100 text-zinc-700"}`}
                    >
                      <option value="pending">Pending</option>
                      <option value="shipped">Shipped</option>
                      <option value="delivered">Delivered</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

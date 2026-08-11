"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Search } from "lucide-react";

type Location = { id: string; name: string; code: string; isDefault: boolean };
type Product = { sku: string; name: string; qtyOnHand: number };
type Transfer = {
  id: string;
  sku: string;
  qty: number;
  note: string | null;
  createdAt: string;
  fromLocation: { name: string };
  toLocation: { name: string };
  requester: { name: string };
};

export default function StockTransferPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);

  const [productQuery, setProductQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedSku, setSelectedSku] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const [fromLocationId, setFromLocationId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [availableAtSource, setAvailableAtSource] = useState<number | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [alertMsg, setAlertMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function triggerAlert(type: "success" | "error", text: string) {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg(null), 4000);
  }

  function loadTransfers() {
    fetch("/api/inventory/transfer").then((r) => r.json()).then((res) => {
      if (res.success) setTransfers(res.data);
    });
  }

  useEffect(() => {
    fetch("/api/admin/locations").then((r) => r.json()).then((res) => {
      if (res.success) {
        setLocations(res.data);
        const def = res.data.find((l: Location) => l.isDefault);
        if (def) setFromLocationId(def.id);
      }
    });
    fetch("/api/pos/products").then((r) => r.json()).then((res) => {
      if (res.success) setProducts(res.data);
    });
    loadTransfers();
  }, []);

  useEffect(() => {
    if (!selectedSku || !fromLocationId) return;
    let cancelled = false;
    fetch(`/api/inventory/location-stock?sku=${encodeURIComponent(selectedSku)}`)
      .then((r) => r.json())
      .then((res) => {
        if (cancelled || !res.success) return;
        const row = (res.data as { locationId: string; qty: number }[]).find(
          (d) => d.locationId === fromLocationId,
        );
        setAvailableAtSource(row ? row.qty : 0);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSku, fromLocationId]);

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .slice(0, 8);
  }, [products, productQuery]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSku) return triggerAlert("error", "Select a product first.");
    if (!fromLocationId || !toLocationId) return triggerAlert("error", "Select both locations.");
    if (fromLocationId === toLocationId) return triggerAlert("error", "Source and destination must differ.");
    const qtyNum = parseInt(qty);
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) return triggerAlert("error", "Enter a valid quantity.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/inventory/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku: selectedSku, qty: qtyNum, fromLocationId, toLocationId, note: note || undefined }),
      });
      const body = await res.json();
      if (body.success) {
        triggerAlert("success", `Transferred ${qtyNum} x ${selectedName}.`);
        setSelectedSku("");
        setSelectedName("");
        setProductQuery("");
        setQty("");
        setNote("");
        setAvailableAtSource(null);
        loadTransfers();
      } else {
        triggerAlert("error", body.error?.message ?? "Transfer failed");
      }
    } catch {
      triggerAlert("error", "Failed to contact server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-zinc-800 tracking-tight flex items-center gap-2">
          <ArrowLeftRight className="h-6 w-6 text-indigo-650" /> Stock Transfer
        </h1>
        <p className="text-xs text-zinc-450 mt-1">
          Move stock between business locations. This relocates existing stock — it doesn&apos;t change the total quantity on hand.
        </p>
      </div>

      {alertMsg && (
        <div
          className={`rounded-lg p-3 text-sm font-semibold border ${
            alertMsg.type === "success"
              ? "bg-green-50 border-green-200 text-green-700"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {alertMsg.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-zinc-200 p-5 shadow-sm space-y-4">
        <div className="relative">
          <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">Product *</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-400">
              <Search className="h-4 w-4" />
            </div>
            <input
              placeholder="Search product name / SKU…"
              value={selectedSku ? `${selectedName} (${selectedSku})` : productQuery}
              onChange={(e) => {
                setSelectedSku("");
                setSelectedName("");
                setAvailableAtSource(null);
                setProductQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              className="h-9 w-full rounded border border-zinc-300 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 bg-white"
            />
          </div>
          {showDropdown && filteredProducts.length > 0 && (
            <div className="absolute z-20 mt-1 w-full bg-white border border-zinc-200 rounded-md shadow-lg max-h-64 overflow-y-auto">
              {filteredProducts.map((p) => (
                <button
                  type="button"
                  key={p.sku}
                  onClick={() => {
                    setSelectedSku(p.sku);
                    setSelectedName(p.name);
                    setShowDropdown(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 flex items-center justify-between"
                >
                  <span>{p.name} <span className="text-xs text-zinc-400">({p.sku})</span></span>
                  <span className="text-xs text-zinc-500">{p.qtyOnHand} total</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">From Location *</label>
            <select
              required
              value={fromLocationId}
              onChange={(e) => setFromLocationId(e.target.value)}
              className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
            >
              <option value="">Select</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
              ))}
            </select>
            {availableAtSource !== null && (
              <p className="text-xs text-zinc-450 mt-1">
                Available: <span className="font-bold text-zinc-700">{availableAtSource}</span>
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">To Location *</label>
            <select
              required
              value={toLocationId}
              onChange={(e) => setToLocationId(e.target.value)}
              className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
            >
              <option value="">Select</option>
              {locations.filter((l) => l.id !== fromLocationId).map((l) => (
                <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">Quantity *</label>
            <input
              type="number"
              min={1}
              required
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="h-9 w-full rounded border border-zinc-300 px-3 text-sm font-mono outline-none focus:border-indigo-500 bg-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">Note</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional"
            className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="bg-indigo-650 hover:bg-indigo-750 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-sm transition disabled:opacity-50 flex items-center gap-2"
          >
            <ArrowLeftRight className="h-4 w-4" /> {submitting ? "Transferring..." : "Transfer Stock"}
          </button>
        </div>
      </form>

      <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-150">
          <h2 className="text-sm font-bold text-zinc-800">Recent Transfers</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-50 text-zinc-650 font-bold border-b border-zinc-150 uppercase tracking-wider text-xs">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3 text-center">Qty</th>
                <th className="px-4 py-3">From</th>
                <th className="px-4 py-3">To</th>
                <th className="px-4 py-3">By</th>
                <th className="px-4 py-3">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-sm">
              {transfers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">No transfers yet.</td>
                </tr>
              )}
              {transfers.map((t) => (
                <tr key={t.id} className="hover:bg-zinc-50/50 transition">
                  <td className="px-4 py-2.5 text-zinc-600">
                    {new Date(t.createdAt).toLocaleDateString("en-GB").replace(/\//g, "-")}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-zinc-600">{t.sku}</td>
                  <td className="px-4 py-2.5 text-center font-mono font-bold text-indigo-600">{t.qty}</td>
                  <td className="px-4 py-2.5 text-zinc-700">{t.fromLocation.name}</td>
                  <td className="px-4 py-2.5 text-zinc-700">{t.toLocation.name}</td>
                  <td className="px-4 py-2.5 text-zinc-600">{t.requester.name}</td>
                  <td className="px-4 py-2.5 text-zinc-500">{t.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

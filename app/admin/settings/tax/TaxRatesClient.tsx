"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Edit, Trash2, X, Star } from "lucide-react";

type TaxRate = {
  id: string;
  name: string;
  rate: number;
  rateType: string;
  isDefault: boolean;
};

export function TaxRatesClient({ initialRates }: { initialRates: TaxRate[] }) {
  const router = useRouter();
  const [rates, setRates] = useState(initialRates);
  // Sync `rates` from the server component's props on router.refresh() —
  // adjusted during render (comparing against the last-seen prop value)
  // rather than in a useEffect, per React's own guidance for "adjusting
  // state when a prop changes": https://react.dev/learn/you-might-not-need-an-effect
  const [prevInitialRates, setPrevInitialRates] = useState(initialRates);
  if (initialRates !== prevInitialRates) {
    setPrevInitialRates(initialRates);
    setRates(initialRates);
  }
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TaxRate | null>(null);
  const [name, setName] = useState("");
  const [rate, setRate] = useState("0");
  const [rateType, setRateType] = useState("Percentage");
  const [isDefault, setIsDefault] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function openAdd() {
    setEditing(null);
    setName("");
    setRate("0");
    setRateType("Percentage");
    setIsDefault(rates.length === 0);
    setError("");
    setFormOpen(true);
  }

  function openEdit(r: TaxRate) {
    setEditing(r);
    setName(r.name);
    setRate(String(r.rate));
    setRateType(r.rateType);
    setIsDefault(r.isDefault);
    setError("");
    setFormOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(editing ? `/api/admin/tax-rates/${editing.id}` : "/api/admin/tax-rates", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, rate: Number(rate), rateType, isDefault }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Failed to save tax rate");
        return;
      }
      setFormOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(r: TaxRate) {
    if (!confirm(`Delete tax rate "${r.name}"?`)) return;
    const res = await fetch(`/api/admin/tax-rates/${r.id}`, { method: "DELETE" });
    const body = await res.json();
    if (body.success) {
      setRates((prev) => prev.filter((x) => x.id !== r.id));
    } else {
      alert(body.error?.message ?? "Failed to delete tax rate");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={openAdd}
          className="bg-indigo-650 hover:bg-indigo-750 text-white px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="h-4 w-4" /> Add Tax Rate
        </button>
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-lg border border-zinc-200 shadow-xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm text-zinc-800">{editing ? "Edit Tax Rate" : "Add Tax Rate"}</h3>
              <button onClick={() => setFormOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-650 mb-1">Name *</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. VAT 15%"
                  className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-650 mb-1">Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    className="h-9 w-full rounded border border-zinc-300 px-3 text-sm font-mono outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-650 mb-1">Type</label>
                  <select
                    value={rateType}
                    onChange={(e) => setRateType(e.target.value)}
                    className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500"
                  >
                    <option value="Percentage">Percentage</option>
                    <option value="Fixed">Fixed (display only)</option>
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-zinc-650">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="h-4 w-4 rounded text-indigo-600"
                />
                Use as the default rate charged at checkout
              </label>
              <div className="flex justify-end gap-2 border-t pt-3">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-3.5 py-1.5 rounded border text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-indigo-650 hover:bg-indigo-750 text-white rounded text-xs font-bold shadow-sm transition disabled:opacity-50"
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
                <th className="px-4 py-3.5">Tax Name</th>
                <th className="px-4 py-3.5">Tax Rate</th>
                <th className="px-4 py-3.5">Rate Type</th>
                <th className="px-4 py-3.5 w-40 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-sm">
              {rates.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-zinc-400">No tax rates yet.</td>
                </tr>
              )}
              {rates.map((tax) => (
                <tr key={tax.id} className="hover:bg-zinc-50/50 transition">
                  <td className="px-4 py-3.5 font-bold text-zinc-800 flex items-center gap-1.5">
                    {tax.name}
                    {tax.isDefault && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-650 text-[11px] font-bold uppercase">
                        <Star className="h-2.5 w-2.5 fill-current" /> Default
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 font-mono text-zinc-600 font-semibold">{tax.rate.toFixed(2)}%</td>
                  <td className="px-4 py-3.5 text-zinc-650 font-semibold">{tax.rateType}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => openEdit(tax)}
                        className="border border-blue-200 text-blue-650 hover:bg-blue-50 px-2.5 py-1 rounded text-xs font-bold transition flex items-center gap-1 bg-white"
                      >
                        <Edit className="h-3 w-3" /> Edit
                      </button>
                      <button
                        onClick={() => handleDelete(tax)}
                        disabled={tax.isDefault}
                        className="border border-red-200 text-red-650 hover:bg-red-50 px-2.5 py-1 rounded text-xs font-bold transition flex items-center gap-1 bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    </div>
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

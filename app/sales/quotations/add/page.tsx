"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { CustomerCombobox } from "@/app/_components/CustomerCombobox";

type Product = { sku: string; name: string; unitPrice: number };
type Line = { sku: string; name: string; qty: number; unitPrice: number };

const currencyFmt = (val: number) =>
  `Rs ${val.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function AddQuotationPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);

  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [validUntil, setValidUntil] = useState("");
  const [discount, setDiscount] = useState("0");
  const [lines, setLines] = useState<Line[]>([]);

  const [productQuery, setProductQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/pos/products").then((r) => r.json()).then((res) => {
      if (res.success) setProducts(res.data);
    });
  }, []);

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .slice(0, 8);
  }, [products, productQuery]);

  function addLine(p: Product) {
    setLines((prev) => {
      const existing = prev.find((l) => l.sku === p.sku);
      if (existing) {
        return prev.map((l) => (l.sku === p.sku ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...prev, { sku: p.sku, name: p.name, qty: 1, unitPrice: p.unitPrice }];
    });
    setProductQuery("");
    setShowDropdown(false);
  }

  function updateLine(sku: string, field: "qty" | "unitPrice", value: number) {
    setLines((prev) => prev.map((l) => (l.sku === sku ? { ...l, [field]: value } : l)));
  }

  function removeLine(sku: string) {
    setLines((prev) => prev.filter((l) => l.sku !== sku));
  }

  const subtotal = lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);
  const total = Math.max(0, subtotal - (Number(discount) || 0));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (lines.length === 0) {
      setError("Add at least one product line.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/sales/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customerId || undefined,
          validUntil: validUntil || undefined,
          discount: Number(discount) || 0,
          items: lines.map((l) => ({ sku: l.sku, name: l.name, qty: l.qty, unitPrice: l.unitPrice })),
        }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Failed to save quotation.");
        return;
      }
      router.push("/sales/quotations");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/sales/quotations" className="text-zinc-400 hover:text-zinc-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-zinc-800 tracking-tight">Add Quotation</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm font-semibold">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-white rounded-lg border border-zinc-200 p-5 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">Customer</label>
              <CustomerCombobox
                value={customerId || null}
                displayName={customerName}
                placeholder="Walk-In Customer"
                onChange={(c) => {
                  setCustomerId(c?.id ?? "");
                  setCustomerName(c?.name ?? null);
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">Valid Until</label>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">Discount (Rs)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="h-9 w-full rounded border border-zinc-300 px-3 text-sm font-mono outline-none focus:border-indigo-500 bg-white"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-zinc-200 p-5 shadow-sm space-y-3">
          <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">Add Products</label>
          <div className="relative">
            <input
              placeholder="Search product name / SKU…"
              value={productQuery}
              onChange={(e) => {
                setProductQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
            />
            {showDropdown && filteredProducts.length > 0 && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-zinc-200 rounded-md shadow-lg max-h-64 overflow-y-auto">
                {filteredProducts.map((p) => (
                  <button
                    type="button"
                    key={p.sku}
                    onClick={() => addLine(p)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 flex items-center justify-between"
                  >
                    <span>{p.name} <span className="text-xs text-zinc-400">({p.sku})</span></span>
                    <span className="text-xs text-zinc-500">{currencyFmt(p.unitPrice)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border border-zinc-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-zinc-50 text-zinc-650 font-bold border-b border-zinc-150 uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-3 py-2.5">Product</th>
                  <th className="px-3 py-2.5 w-28 text-center">Qty</th>
                  <th className="px-3 py-2.5 w-36 text-right">Unit Price</th>
                  <th className="px-3 py-2.5 w-36 text-right">Line Total</th>
                  <th className="px-3 py-2.5 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {lines.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-zinc-400">
                      No products added yet — search above to add a line.
                    </td>
                  </tr>
                )}
                {lines.map((l) => (
                  <tr key={l.sku}>
                    <td className="px-3 py-2 font-semibold text-zinc-750">
                      {l.name} <span className="text-zinc-400 font-normal">({l.sku})</span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="number"
                        min={1}
                        value={l.qty}
                        onChange={(e) => updateLine(l.sku, "qty", Math.max(1, parseInt(e.target.value) || 1))}
                        className="h-8 w-20 rounded border border-zinc-300 px-2 text-center font-mono outline-none focus:border-indigo-500"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={l.unitPrice}
                        onChange={(e) => updateLine(l.sku, "unitPrice", Math.max(0, parseFloat(e.target.value) || 0))}
                        className="h-8 w-28 rounded border border-zinc-300 px-2 text-right font-mono outline-none focus:border-indigo-500"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-indigo-600">
                      {currencyFmt(l.qty * l.unitPrice)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button type="button" onClick={() => removeLine(l.sku)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end border-t pt-3 gap-6 text-sm">
            <div className="text-zinc-500">Subtotal: <span className="font-mono text-zinc-700">{currencyFmt(subtotal)}</span></div>
            <div className="font-bold text-zinc-800">
              Total: <span className="text-indigo-650 font-mono">{currencyFmt(total)}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Link
            href="/sales/quotations"
            className="px-4 py-2.5 rounded-lg border text-sm font-semibold text-zinc-600 hover:bg-zinc-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="bg-indigo-650 hover:bg-indigo-750 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-sm transition disabled:opacity-50 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> {submitting ? "Saving..." : "Save Quotation"}
          </button>
        </div>
      </form>
    </main>
  );
}

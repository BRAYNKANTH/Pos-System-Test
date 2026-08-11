"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, FileText } from "lucide-react";
import { useCartStore } from "@/lib/pos/cart-store";

type QuotationRow = {
  id: string;
  referenceNo: string;
  createdAt: string;
  customerName: string;
  itemCount: number;
  total: string;
  status: string;
  createdBy: string;
};

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-700",
  sent: "bg-blue-50 text-blue-700",
  converted: "bg-green-50 text-green-700",
  expired: "bg-red-50 text-red-700",
};

export function QuotationsClient({ initialQuotations }: { initialQuotations: QuotationRow[] }) {
  const router = useRouter();
  const [quotations, setQuotations] = useState(initialQuotations);
  const loadQuotationItems = useCartStore((s) => s.loadQuotationItems);
  const [converting, setConverting] = useState<string | null>(null);

  async function handleConvert(id: string) {
    setConverting(id);
    try {
      const res = await fetch(`/api/sales/quotations/${id}/convert`, { method: "POST" });
      const body = await res.json();
      if (!body.success) {
        alert(body.error?.message ?? "Failed to convert quotation");
        return;
      }
      loadQuotationItems({
        lines: body.data.items.map((i: { sku: string; name: string; unitPrice: string | number; qty: number }) => ({
          sku: i.sku,
          name: i.name,
          unitPrice: Number(i.unitPrice),
          qty: i.qty,
        })),
        customerId: body.data.customerId,
        customerName: body.data.customer?.name ?? null,
      });
      router.push("/pos");
    } finally {
      setConverting(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-zinc-800 tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6 text-indigo-650" /> Quotations
          </h1>
          <p className="text-xs text-zinc-450 mt-1">Non-binding price quotes — no stock or ledger impact until converted to a real sale.</p>
        </div>
        <Link
          href="/sales/quotations/add"
          className="bg-indigo-650 hover:bg-indigo-750 text-white px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="h-4 w-4" /> Add Quotation
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-50 text-zinc-650 font-bold border-b border-zinc-150 uppercase tracking-wider text-xs">
              <tr>
                <th className="px-4 py-3.5">Reference No.</th>
                <th className="px-4 py-3.5">Date</th>
                <th className="px-4 py-3.5">Customer</th>
                <th className="px-4 py-3.5 text-center">Items</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Total</th>
                <th className="px-4 py-3.5">Created By</th>
                <th className="px-4 py-3.5 w-40 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-sm">
              {quotations.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-zinc-400">No quotations yet.</td>
                </tr>
              )}
              {quotations.map((q) => (
                <tr key={q.id} className="hover:bg-zinc-50/50 transition">
                  <td className="px-4 py-3.5 font-mono font-semibold text-zinc-700">{q.referenceNo}</td>
                  <td className="px-4 py-3.5 text-zinc-600">{q.createdAt}</td>
                  <td className="px-4 py-3.5 font-bold text-zinc-800">{q.customerName}</td>
                  <td className="px-4 py-3.5 text-center text-zinc-600">{q.itemCount}</td>
                  <td className="px-4 py-3.5">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold capitalize ${STATUS_STYLES[q.status] ?? "bg-zinc-100 text-zinc-700"}`}>
                      {q.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono font-bold text-indigo-600">{q.total}</td>
                  <td className="px-4 py-3.5 text-zinc-600">{q.createdBy}</td>
                  <td className="px-4 py-3.5 text-center">
                    {(q.status === "draft" || q.status === "sent") && (
                      <button
                        onClick={() => handleConvert(q.id)}
                        disabled={converting === q.id}
                        className="border border-green-200 text-green-650 hover:bg-green-50 px-2.5 py-1 rounded text-xs font-bold transition bg-white disabled:opacity-50"
                      >
                        {converting === q.id ? "Loading..." : "Convert to Sale"}
                      </button>
                    )}
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

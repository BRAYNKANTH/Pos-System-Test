"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Search, RotateCcw, Repeat } from "lucide-react";

type ReturnRow = {
  id: string;
  createdAt: string;
  transactionId: string;
  customerName: string;
  itemCount: number;
  refundAmount: string;
  refundMethod: string;
  reason: string;
  createdBy: string;
  isExchange: boolean;
  exchangeTotal: string;
  netAmount: number;
  netAmountFmt: string;
};

type ReceiptItem = { sku: string; qty: number; unitPrice: number };
type Receipt = { id: string; customerName: string | null; items: ReceiptItem[]; status: string };
type Product = { sku: string; name: string; unitPrice: number; qtyOnHand: number };
type ExchangeLine = { sku: string; name: string; qty: number; unitPrice: number };

export function SalesReturnsClient({
  initialReturns,
  canCreate,
}: {
  initialReturns: ReturnRow[];
  canCreate: boolean;
}) {
  const router = useRouter();
  const [returns, setReturns] = useState(initialReturns);
  const [modalOpen, setModalOpen] = useState(false);
  const [txId, setTxId] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [returnQty, setReturnQty] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [refundMethod, setRefundMethod] = useState("cash");
  const [lookingUp, setLookingUp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Exchange mode — replacement item(s) going out in the same operation.
  const [isExchange, setIsExchange] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [exchangeQuery, setExchangeQuery] = useState("");
  const [exchangeLines, setExchangeLines] = useState<ExchangeLine[]>([]);
  const [netPaymentMethod, setNetPaymentMethod] = useState("cash");

  function openModal() {
    setTxId("");
    setReceipt(null);
    setReturnQty({});
    setReason("");
    setRefundMethod("cash");
    setIsExchange(false);
    setExchangeLines([]);
    setExchangeQuery("");
    setNetPaymentMethod("cash");
    setError("");
    setModalOpen(true);
    if (products.length === 0) {
      fetch("/api/pos/products")
        .then((r) => r.json())
        .then((res) => {
          if (res.success) setProducts(res.data);
        });
    }
  }

  const returnTotal = Object.entries(returnQty).reduce((sum, [sku, qty]) => {
    const item = receipt?.items.find((i) => i.sku === sku);
    return item ? sum + item.unitPrice * Number(qty || 0) : sum;
  }, 0);
  const exchangeTotal = exchangeLines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);
  const netAmount = Math.round((exchangeTotal - returnTotal) * 100) / 100;

  const exchangeMatches = exchangeQuery.trim()
    ? products.filter(
        (p) =>
          p.qtyOnHand > 0 &&
          (p.name.toLowerCase().includes(exchangeQuery.toLowerCase()) || p.sku.toLowerCase().includes(exchangeQuery.toLowerCase())),
      )
    : [];

  function addExchangeLine(p: Product) {
    setExchangeLines((prev) => {
      const existing = prev.find((l) => l.sku === p.sku);
      if (existing) return prev.map((l) => (l.sku === p.sku ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { sku: p.sku, name: p.name, qty: 1, unitPrice: p.unitPrice }];
    });
    setExchangeQuery("");
  }

  function setExchangeQty(sku: string, qty: number) {
    setExchangeLines((prev) =>
      qty <= 0 ? prev.filter((l) => l.sku !== sku) : prev.map((l) => (l.sku === sku ? { ...l, qty } : l)),
    );
  }

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setLookingUp(true);
    setError("");
    setReceipt(null);
    try {
      const res = await fetch(`/api/pos/receipt/${encodeURIComponent(txId.trim())}`);
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Transaction not found");
        return;
      }
      if (body.data.status !== "completed") {
        setError(`This sale's status is "${body.data.status}", not completed — can't process a return against it.`);
        return;
      }
      setReceipt(body.data);
      setReturnQty(Object.fromEntries(body.data.items.map((i: ReceiptItem) => [i.sku, "0"])));
    } finally {
      setLookingUp(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!receipt) return;
    const items = Object.entries(returnQty)
      .map(([sku, qty]) => ({ sku, qty: Number(qty) }))
      .filter((i) => i.qty > 0);

    if (items.length === 0) {
      setError("Enter a quantity to return for at least one item.");
      return;
    }
    if (isExchange && exchangeLines.length === 0) {
      setError("Add at least one replacement item, or turn off exchange mode.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/sales/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: receipt.id,
          items,
          reason,
          refundMethod,
          exchangeItems: isExchange ? exchangeLines.map((l) => ({ sku: l.sku, qty: l.qty })) : undefined,
          netPaymentMethod: isExchange ? netPaymentMethod : undefined,
        }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Failed to record return");
        return;
      }
      setModalOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-zinc-800 tracking-tight flex items-center gap-2">
            <RotateCcw className="h-6 w-6 text-indigo-650" /> Sell Returns
          </h1>
          <p className="text-xs text-zinc-450 mt-1">
            Customer returns of already-sold items — restocks inventory and records a refund.
          </p>
        </div>
        {canCreate && (
          <button
            onClick={openModal}
            className="bg-indigo-650 hover:bg-indigo-750 text-white px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" /> New Return
          </button>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-lg border border-zinc-200 shadow-xl max-w-lg w-full p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm text-zinc-800">New Sales Return</h3>
              <button onClick={() => setModalOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}

            {!receipt ? (
              <form onSubmit={handleLookup} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-650 mb-1">Transaction / Invoice ID</label>
                  <div className="flex gap-2">
                    <input
                      required
                      autoFocus
                      value={txId}
                      onChange={(e) => setTxId(e.target.value)}
                      placeholder="Paste the transaction ID from the receipt"
                      className="h-9 flex-1 rounded border border-zinc-300 px-3 text-sm font-mono outline-none focus:border-indigo-500"
                    />
                    <button
                      type="submit"
                      disabled={lookingUp}
                      className="px-4 bg-indigo-650 hover:bg-indigo-750 text-white rounded text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Search className="h-3.5 w-3.5" /> {lookingUp ? "..." : "Find"}
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-450 mt-1">
                    Find it on the sale&apos;s receipt or on{" "}
                    <a href="/sales" className="underline text-indigo-650">All Sales</a>.
                  </p>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <p className="text-xs text-zinc-500">
                  Customer: <span className="font-bold text-zinc-700">{receipt.customerName ?? "Walk-In"}</span>
                </p>
                <div className="border border-zinc-200 rounded-md divide-y divide-zinc-150">
                  {receipt.items.map((item) => (
                    <div key={item.sku} className="flex items-center justify-between gap-3 px-3 py-2">
                      <div>
                        <p className="text-xs font-bold text-zinc-800">{item.sku}</p>
                        <p className="text-[11px] text-zinc-450">Sold qty: {item.qty} · Rs {item.unitPrice.toFixed(2)} each</p>
                      </div>
                      <input
                        type="number"
                        min="0"
                        max={item.qty}
                        value={returnQty[item.sku] ?? "0"}
                        onChange={(e) => setReturnQty((prev) => ({ ...prev, [item.sku]: e.target.value }))}
                        className="h-8 w-20 rounded border border-zinc-300 px-2 text-center text-xs font-mono outline-none focus:border-indigo-500"
                      />
                    </div>
                  ))}
                </div>

                <label className="flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50/50 px-3 py-2.5 text-xs font-bold text-indigo-700 cursor-pointer dark:border-indigo-900 dark:bg-indigo-950/10">
                  <input
                    type="checkbox"
                    checked={isExchange}
                    onChange={(e) => setIsExchange(e.target.checked)}
                    className="h-4 w-4 rounded text-indigo-600"
                  />
                  <Repeat className="h-3.5 w-3.5" />
                  This is an exchange — customer is taking different item(s) instead
                </label>

                {isExchange && (
                  <div className="space-y-2 rounded-md border border-zinc-200 p-3">
                    <label className="block text-xs font-bold text-zinc-650">Replacement item(s)</label>
                    <div className="relative">
                      <input
                        value={exchangeQuery}
                        onChange={(e) => setExchangeQuery(e.target.value)}
                        placeholder="Search product to add..."
                        className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500"
                      />
                      {exchangeMatches.length > 0 && (
                        <div className="absolute left-0 right-0 z-10 mt-1 max-h-48 overflow-y-auto rounded-md border border-zinc-200 bg-white py-1 shadow-lg">
                          {exchangeMatches.map((p) => (
                            <button
                              type="button"
                              key={p.sku}
                              onClick={() => addExchangeLine(p)}
                              className="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-zinc-50"
                            >
                              <span className="font-semibold text-zinc-800">{p.name}</span>
                              <span className="font-mono text-zinc-500">Rs {p.unitPrice.toFixed(2)}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {exchangeLines.length > 0 && (
                      <div className="border border-zinc-200 rounded-md divide-y divide-zinc-150">
                        {exchangeLines.map((l) => (
                          <div key={l.sku} className="flex items-center justify-between gap-3 px-3 py-2">
                            <div>
                              <p className="text-xs font-bold text-zinc-800">{l.name}</p>
                              <p className="text-[11px] text-zinc-450">Rs {l.unitPrice.toFixed(2)} each</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="0"
                                value={l.qty}
                                onChange={(e) => setExchangeQty(l.sku, Number(e.target.value))}
                                className="h-8 w-16 rounded border border-zinc-300 px-2 text-center text-xs font-mono outline-none focus:border-indigo-500"
                              />
                              <button type="button" onClick={() => setExchangeQty(l.sku, 0)} className="text-red-500 hover:text-red-700">
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2 text-xs font-bold border border-zinc-150">
                      <span className="text-zinc-600">Net {netAmount >= 0 ? "due from customer" : "owed back to customer"}</span>
                      <span className={netAmount >= 0 ? "text-red-650" : "text-green-650"}>
                        Rs {Math.abs(netAmount).toFixed(2)}
                      </span>
                    </div>
                    {netAmount !== 0 && (
                      <div>
                        <label className="block text-xs font-bold text-zinc-650 mb-1">
                          {netAmount > 0 ? "Collected via" : "Refunded via"}
                        </label>
                        <select
                          value={netPaymentMethod}
                          onChange={(e) => setNetPaymentMethod(e.target.value)}
                          className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500"
                        >
                          <option value="cash">Cash</option>
                          <option value="card">Card</option>
                          <option value="wallet">Wallet</option>
                        </select>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-zinc-650 mb-1">Reason *</label>
                  <input
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Damaged, wrong item, customer changed mind"
                    className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-650 mb-1">Refund Method</label>
                  <select
                    value={refundMethod}
                    onChange={(e) => setRefundMethod(e.target.value)}
                    className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500"
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="store_credit">Store Credit</option>
                  </select>
                </div>
                <div className="flex justify-between gap-2 border-t pt-3">
                  <button
                    type="button"
                    onClick={() => setReceipt(null)}
                    className="px-3.5 py-1.5 rounded border text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className={`px-4 py-1.5 text-white rounded text-xs font-bold shadow-sm transition disabled:opacity-50 ${
                      isExchange ? "bg-indigo-650 hover:bg-indigo-750" : "bg-red-600 hover:bg-red-700"
                    }`}
                  >
                    {submitting ? "Processing..." : isExchange ? "Process Exchange" : "Process Return"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-50 text-zinc-650 font-bold border-b border-zinc-150 uppercase tracking-wider text-xs">
              <tr>
                <th className="px-4 py-3.5">Date</th>
                <th className="px-4 py-3.5">Type</th>
                <th className="px-4 py-3.5">Transaction</th>
                <th className="px-4 py-3.5">Customer</th>
                <th className="px-4 py-3.5 text-center">Items</th>
                <th className="px-4 py-3.5">Reason</th>
                <th className="px-4 py-3.5">Method</th>
                <th className="px-4 py-3.5 text-right">Amount</th>
                <th className="px-4 py-3.5">Processed By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-sm">
              {returns.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-zinc-400">No returns recorded yet.</td>
                </tr>
              )}
              {returns.map((r) => (
                <tr key={r.id} className="hover:bg-zinc-50/50 transition">
                  <td className="px-4 py-3.5 text-zinc-600">{r.createdAt}</td>
                  <td className="px-4 py-3.5">
                    {r.isExchange ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-650 text-[11px] font-bold uppercase">
                        <Repeat className="h-2.5 w-2.5" /> Exchange
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 text-[11px] font-bold uppercase">
                        Return
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 font-mono text-zinc-500 text-[11px]">{r.transactionId.slice(0, 12)}…</td>
                  <td className="px-4 py-3.5 font-bold text-zinc-800">{r.customerName}</td>
                  <td className="px-4 py-3.5 text-center text-zinc-600">{r.itemCount}</td>
                  <td className="px-4 py-3.5 text-zinc-600">{r.reason}</td>
                  <td className="px-4 py-3.5 text-zinc-600 capitalize">{r.refundMethod.replace("_", " ")}</td>
                  <td className="px-4 py-3.5 text-right font-mono font-bold">
                    {r.isExchange ? (
                      <span className={r.netAmount >= 0 ? "text-red-650" : "text-green-650"}>
                        {r.netAmount >= 0 ? "+" : "-"}{r.netAmountFmt}
                      </span>
                    ) : (
                      <span className="text-red-650">-{r.refundAmount}</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-zinc-600">{r.createdBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

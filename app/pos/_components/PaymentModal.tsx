"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/lib/pos/cart-store";
import { Button } from "@/components/ui/button";
import { queueOfflineTransaction } from "@/lib/offline/sync";
import { Banknote, CreditCard, Wallet, Trash2, Plus, X, Printer } from "lucide-react";

type PaymentTender = {
  method: "cash" | "card" | "wallet";
  amount: number;
  note?: string;
};

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  total: number;
  totalItems: number;
  calculationPayload: any;
}

export function PaymentModal({ open, onClose, total, totalItems, calculationPayload }: PaymentModalProps) {
  const router = useRouter();
  const { lines, discount, shipping, customerId, clear, heldCartId } = useCartStore();
  const [tenders, setTenders] = useState<PaymentTender[]>([
    { method: "cash", amount: total },
  ]);
  const [sellNote, setSellNote] = useState("");
  const [staffNote, setStaffNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [completedTxId, setCompletedTxId] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  // Sync initial tender amount when total changes (e.g. before user starts typing)
  useEffect(() => {
    if (tenders.length === 1 && tenders[0].amount === 0) {
      setTenders([{ method: "cash", amount: total }]);
    }
  }, [total]);

  // Load receipt details on mount/update when transaction is successfully checked out
  useEffect(() => {
    if (!completedTxId) return;
    setLoadingReceipt(true);
    fetch(`/api/pos/receipt/${completedTxId}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setReceiptData(res.data);
      })
      .catch((err) => console.error("Failed to load receipt details:", err))
      .finally(() => setLoadingReceipt(false));
  }, [completedTxId]);

  if (!open) return null;

  const totalPaying = Math.round(tenders.reduce((sum, t) => sum + Number(t.amount || 0), 0) * 100) / 100;
  const balance = Math.max(0, Math.round((total - totalPaying) * 100) / 100);
  const changeReturn = Math.max(0, Math.round((totalPaying - total) * 100) / 100);

  function addPaymentRow() {
    // Default the next row's amount to the remaining balance
    setTenders((prev) => [...prev, { method: "cash", amount: balance }]);
  }

  function removePaymentRow(index: number) {
    if (tenders.length <= 1) return;
    setTenders((prev) => prev.filter((_, i) => i !== index));
  }

  function updateTender(index: number, key: keyof PaymentTender, value: any) {
    setTenders((prev) =>
      prev.map((t, i) => (i === index ? { ...t, [key]: value } : t))
    );
  }

  function handleNewSale() {
    setCompletedTxId(null);
    setReceiptData(null);
    onClose();
  }

  async function handleFinalize() {
    setError(null);
    setSubmitting(true);

    const checkoutPayload = {
      items: lines.map((l) => ({
        sku: l.sku,
        qty: l.qty,
        priceOverride: l.priceOverride ?? undefined,
        lineDiscount: l.lineDiscount ?? undefined,
      })),
      discount: discount ? { scope: "cart" as const, type: discount.type, value: discount.value } : undefined,
      shipping,
      customerId,
      tenders: tenders.map((t) => ({ method: t.method, amount: t.amount })),
      sellNote,
      staffNote,
      idempotencyKey: crypto.randomUUID(),
    };

    try {
      const res = await fetch("/api/pos/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checkoutPayload),
      });

      // Handle server non-JSON HTML error fallback (502/504 Bad Gateways)
      const text = await res.text();
      let body;
      try {
        body = JSON.parse(text);
      } catch (err) {
        throw new SyntaxError("Failed to parse JSON response");
      }

      if (!res.ok || !body.success) {
        setError(body.error?.message ?? `Checkout failed (${res.status})`);
        return;
      }

      // If this was a resumed held cart, delete the original draft from the database
      if (heldCartId) {
        await fetch(`/api/pos/held-carts/${heldCartId}`, { method: "DELETE" }).catch(() => {});
      }

      clear();
      // Show receipt preview instead of instantly redirecting
      setCompletedTxId(body.data.transactionId);
    } catch (err) {
      // Catch offline / gateway timeout / parsing issues
      console.warn("API error, falling back to offline IndexedDB queue:", err);
      try {
        await queueOfflineTransaction(checkoutPayload.idempotencyKey, {
          items: checkoutPayload.items,
          tenders: checkoutPayload.tenders,
          discount: checkoutPayload.discount,
          shipping: checkoutPayload.shipping,
          customerId: checkoutPayload.customerId,
          registerId: "register-1",
        });

        // Delete from held carts if it succeeded offline
        if (heldCartId) {
          // just try to delete if possible, otherwise offline sync will do it
          fetch(`/api/pos/held-carts/${heldCartId}`, { method: "DELETE" }).catch(() => {});
        }

        clear();
        onClose();
        router.push("/pos?offline=1");
      } catch (offlineErr) {
        setError("Network is down and could not save transaction locally. Please check IndexedDB permissions.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Render the Receipt Preview Modal overlay on successful payment completion
  if (completedTxId) {
    const tendersTotal = receiptData ? receiptData.tenders.reduce((sum: number, t: any) => sum + t.amount, 0) : 0;
    const changePaid = receiptData ? Math.max(0, tendersTotal - receiptData.total) : 0;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 animate-fade-in print:p-0 print:bg-white">
        <div className="flex w-full max-w-md flex-col rounded-lg bg-zinc-50 border shadow-2xl dark:bg-zinc-900 overflow-hidden print:w-full print:border-0 print:shadow-none">
          
          <div className="flex items-center justify-between border-b bg-white px-5 py-3.5 dark:bg-zinc-950 print:hidden">
            <h3 className="font-bold text-sm text-zinc-800 dark:text-zinc-200">Receipt Details</h3>
            <button onClick={handleNewSale} className="rounded hover:bg-zinc-100 p-1 dark:hover:bg-zinc-800 text-zinc-500">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 max-h-[68vh] flex justify-center bg-zinc-150 dark:bg-zinc-900 print:bg-white print:p-0 print:overflow-visible">
            {loadingReceipt && (
              <div className="w-full max-w-[310px] h-72 flex flex-col items-center justify-center gap-2">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"></div>
                <p className="text-xs font-bold text-zinc-500 animate-pulse">Generating receipt slip...</p>
              </div>
            )}

            {!loadingReceipt && receiptData && (
              <div className="printable-receipt bg-white text-zinc-950 border border-zinc-200 p-5 rounded-md shadow-sm font-mono text-[11px] leading-relaxed w-[310px] select-none dark:bg-white dark:text-zinc-950 print:border-0 print:shadow-none print:w-[80mm] print:p-2">
                {/* Header */}
                <div className="text-center space-y-1 mb-3">
                  <h4 className="text-xs font-extrabold uppercase tracking-wide text-zinc-900">Mektas Supers</h4>
                  <p className="text-[10px] text-zinc-650">Colombo Branch</p>
                  {receiptData.tax > 0 && <p className="text-[10px] font-bold text-zinc-700">TAX ID: 102-392-120</p>}
                  <div className="pt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-zinc-100 px-2 py-0.5 rounded text-zinc-800 border">
                      {receiptData.status === "voided" ? "Void Invoice" : receiptData.headingText}
                    </span>
                  </div>
                </div>

                {/* Metadata */}
                <div className="space-y-1 border-t border-dashed border-zinc-300 py-2 text-[10px] text-zinc-600">
                  <div className="flex justify-between">
                    <span>Invoice No:</span>
                    <span className="font-bold text-zinc-900 uppercase font-sans">{receiptData.id.slice(-8)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Date:</span>
                    <span>{new Date(receiptData.createdAt).toLocaleDateString()} {new Date(receiptData.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cashier:</span>
                    <span>{receiptData.cashierName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Customer:</span>
                    <span className="font-bold text-zinc-900">{receiptData.customerName ?? "Walk-In Customer"}</span>
                  </div>
                </div>

                {/* Table Header */}
                <div className="border-t border-zinc-900 pt-2 pb-1 text-[9px] font-bold text-zinc-900 flex justify-between">
                  <span className="flex-1">Item</span>
                  <span className="w-8 text-center">Qty</span>
                  <span className="w-14 text-right">Price</span>
                  <span className="w-12 text-right">Disc</span>
                  <span className="w-14 text-right">Total</span>
                </div>
                <div className="border-b border-zinc-400 mb-2"></div>

                {/* Table Items */}
                <div className="space-y-1.5 pb-2">
                  {receiptData.items.map((item: any, idx: number) => {
                    const lineSub = item.unitPrice * item.qty - item.discount;
                    return (
                      <div key={idx} className="flex justify-between text-zinc-900 font-semibold text-[10px] leading-tight">
                        <span className="flex-1 truncate pr-1">{item.sku}</span>
                        <span className="w-8 text-center font-sans font-normal">{item.qty}</span>
                        <span className="w-14 text-right font-sans font-normal">{item.unitPrice.toFixed(2)}</span>
                        <span className="w-12 text-right font-sans font-normal text-red-650">
                          {item.discount > 0 ? `-${item.discount.toFixed(0)}` : "0.00"}
                        </span>
                        <span className="w-14 text-right font-sans">{lineSub.toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Totals */}
                <div className="border-t border-dashed border-zinc-300 py-2.5 space-y-1 text-zinc-800 text-[10.5px]">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-sans">Rs {receiptData.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax</span>
                    <span className="font-sans">Rs {receiptData.tax.toFixed(2)}</span>
                  </div>
                  {receiptData.shipping > 0 && (
                    <div className="flex justify-between">
                      <span>Shipping</span>
                      <span className="font-sans">Rs {receiptData.shipping.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-zinc-900 font-extrabold text-sm border-t border-dashed border-zinc-300 pt-2">
                    <span>TOTAL</span>
                    <span className="font-sans">Rs {receiptData.total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Payments */}
                <div className="border-t border-zinc-900 pt-2 pb-1.5 space-y-1 text-[10px] text-zinc-650">
                  {receiptData.tenders.map((t: any, idx: number) => (
                    <div key={idx} className="flex justify-between">
                      <span className="capitalize">{t.method} Pay:</span>
                      <span className="font-sans">Rs {t.amount.toFixed(2)}</span>
                    </div>
                  ))}
                  {changePaid > 0 && (
                    <div className="flex justify-between font-bold text-zinc-900">
                      <span>Change Paid:</span>
                      <span className="font-sans">Rs {changePaid.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="border-t border-dashed border-zinc-300 pt-3 text-center text-[9px] text-zinc-500">
                  <p className="font-bold">Thank you for shopping with us!</p>
                  <p>Please come again.</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t bg-white px-5 py-4 dark:bg-zinc-950 print:hidden gap-3">
            <a
              href="/admin/settings/printers"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs font-semibold hover:bg-zinc-100 text-zinc-650 transition dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-300 shrink-0"
            >
              <Printer className="h-4 w-4 text-indigo-500" />
              <span>Printer Settings</span>
            </a>

            <div className="flex items-center gap-2 flex-1 justify-end">
              <button
                onClick={() => window.print()}
                className="h-9 px-4 rounded-lg bg-green-600 hover:bg-green-700 text-xs font-bold text-white transition flex items-center gap-1.5 shadow-sm"
              >
                Print
              </button>
              <button
                onClick={handleNewSale}
                className="h-9 px-4 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white transition animate-pulse"
              >
                New Sale
              </button>
            </div>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-fade-in">
      <div className="flex w-full max-w-4xl flex-col rounded-lg bg-white shadow-xl dark:bg-zinc-950 overflow-hidden md:flex-row">
        
        {/* Left Side: Forms */}
        <div className="flex-1 p-6 overflow-y-auto max-h-[85vh]">
          <div className="flex items-center justify-between mb-4 border-b pb-2">
            <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">Payment</h2>
            <button onClick={onClose} className="rounded hover:bg-zinc-100 p-1 dark:hover:bg-zinc-800 text-zinc-500">
              <X className="h-5 w-5" />
            </button>
          </div>

          <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 mb-4">
            Advance Balance: <span className="font-mono">Rs 0.00</span>
          </p>

          <div className="space-y-4 mb-6">
            {tenders.map((tender, index) => (
              <div key={index} className="flex flex-col gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900 md:flex-row md:items-end">
                
                {/* Amount */}
                <div className="flex-1 flex flex-col gap-1">
                  <label className="text-xs font-semibold text-zinc-500">Amount:*</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-400">
                      <Banknote className="h-4 w-4" />
                    </div>
                    <input
                      type="number"
                      value={tender.amount === 0 ? "" : tender.amount}
                      onChange={(e) => updateTender(index, "amount", Number(e.target.value))}
                      placeholder="0.00"
                      className="h-9 w-full rounded border border-zinc-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 font-mono"
                    />
                  </div>
                </div>

                {/* Payment Method */}
                <div className="w-full md:w-48 flex flex-col gap-1">
                  <label className="text-xs font-semibold text-zinc-500">Payment Method:*</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-400">
                      {tender.method === "cash" && <Banknote className="h-4 w-4" />}
                      {tender.method === "card" && <CreditCard className="h-4 w-4" />}
                      {tender.method === "wallet" && <Wallet className="h-4 w-4" />}
                    </div>
                    <select
                      value={tender.method}
                      onChange={(e) => updateTender(index, "method", e.target.value)}
                      className="h-9 w-full rounded border border-zinc-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 capitalize"
                    >
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="wallet">Wallet</option>
                    </select>
                  </div>
                </div>

                {/* Remove button */}
                {tenders.length > 1 && (
                  <button
                    onClick={() => removePaymentRow(index)}
                    className="h-9 px-3 rounded bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/20 dark:text-red-400 self-end flex items-center justify-center"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}

            <button
              onClick={addPaymentRow}
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-400 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Payment Row
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-500">Sell note:</label>
              <textarea
                value={sellNote}
                onChange={(e) => setSellNote(e.target.value)}
                placeholder="Write sell note here..."
                rows={3}
                className="rounded border border-zinc-300 bg-transparent p-2 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-500">Staff note:</label>
              <textarea
                value={staffNote}
                onChange={(e) => setStaffNote(e.target.value)}
                placeholder="Write internal staff note here..."
                rows={3}
                className="rounded border border-zinc-300 bg-transparent p-2 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700"
              />
            </div>
          </div>

          {error && <p className="mt-4 text-xs font-medium text-red-600">{error}</p>}
        </div>

        {/* Right Side: Totals Summary (Orange Panel) */}
        <div className="w-full md:w-80 bg-amber-500 text-white p-6 flex flex-col justify-between">
          <div className="space-y-6">
            <div className="border-b border-white/20 pb-4">
              <p className="text-xs text-white/80 uppercase tracking-wider font-semibold">Total Items</p>
              <p className="text-3xl font-extrabold font-mono mt-1">{totalItems.toFixed(2)}</p>
            </div>

            <div className="border-b border-white/20 pb-4">
              <p className="text-xs text-white/80 uppercase tracking-wider font-semibold">Total Payable</p>
              <p className="text-3xl font-extrabold font-mono mt-1">Rs {total.toFixed(2)}</p>
            </div>

            <div className="border-b border-white/20 pb-4">
              <p className="text-xs text-white/80 uppercase tracking-wider font-semibold">Total Paying</p>
              <p className="text-3xl font-extrabold font-mono mt-1">Rs {totalPaying.toFixed(2)}</p>
            </div>

            <div className="border-b border-white/20 pb-4">
              <p className="text-xs text-white/80 uppercase tracking-wider font-semibold">Change Return</p>
              <p className="text-3xl font-extrabold font-mono mt-1">Rs {changeReturn.toFixed(2)}</p>
            </div>

            <div>
              <p className="text-xs text-white/80 uppercase tracking-wider font-semibold">Balance</p>
              <p className="text-3xl font-extrabold font-mono mt-1">Rs {balance.toFixed(2)}</p>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-2 md:mt-0">
            <button
              onClick={onClose}
              className="h-10 w-full rounded bg-zinc-800 hover:bg-zinc-700 text-sm font-bold text-white transition uppercase"
            >
              Close
            </button>
            <button
              disabled={submitting || totalPaying < total || total === 0}
              onClick={handleFinalize}
              className="h-10 w-full rounded bg-indigo-600 hover:bg-indigo-700 text-sm font-bold text-white transition uppercase disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Finalizing…" : "Finalize Payment"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

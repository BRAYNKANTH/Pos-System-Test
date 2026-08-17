"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/lib/pos/cart-store";
import { Button } from "@/components/ui/button";
import { queueOfflineTransaction } from "@/lib/offline/sync";
import { Banknote, CreditCard, Wallet, Trash2, Plus, X, Printer } from "lucide-react";

type PaymentTender = {
  method: "cash" | "card" | "wallet" | "gift_card";
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

  // Reset to a single cash tender pre-filled with the current total every
  // time the modal transitions from closed to open — not every time
  // `total` changes. This component is never unmounted (it just renders
  // null while closed), so without this, leftover tender state from a
  // PREVIOUS transaction stuck around: the amount only auto-filled when
  // it happened to be exactly 0, which is only true before the very
  // first payment of a session. Every "Pay Now" after that opened the
  // modal with the last sale's leftover tender amount still in place —
  // if the new cart's total was higher, "Finalize & Print" stayed
  // disabled (totalPaying < total) with no visible reason why, which is
  // exactly what read as "the pay now button isn't working."
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setTenders([{ method: "cash", amount: total }]);
      setSellNote("");
      setStaffNote("");
      setError(null);
    }
    wasOpenRef.current = open;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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

      // Process gift card deductions if applicable
      for (const t of tenders) {
        if (t.method === "gift_card" && t.note) {
          await fetch(`/api/admin/gift-cards/${encodeURIComponent(t.note)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deductAmount: t.amount }),
          }).catch(() => {});
        }
      }

      // If customer linked, calculate & credit earned loyalty points
      if (customerId) {
        await fetch("/api/customers/loyalty", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customerId, amountSpent: total }),
        }).catch(() => {});
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

  // Keyboard listener inside payment modal
  useEffect(() => {
    if (!open || completedTxId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) {
        e.preventDefault();
        onClose();
      } else if (e.key === "Enter" && !e.shiftKey && !submitting && totalPaying >= total && total > 0) {
        const activeTag = document.activeElement?.tagName.toLowerCase();
        if (activeTag !== "textarea") {
          e.preventDefault();
          handleFinalize();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, completedTxId, submitting, totalPaying, total]);

  // This must come after every hook (useState/useRef/useEffect above) and
  // before any plain logic that doesn't need to run while closed. It used
  // to sit right after the second useEffect, with the keyboard-listener
  // useEffect declared below it — meaning that hook only ran while `open`
  // was true, so React saw a different number of hooks between the
  // "closed" and "open" renders and crashed with "Rendered more hooks
  // than during the previous render" on literally the first Pay Now
  // click of any session. Hooks must always run unconditionally, in the
  // same order, every render — this component is never unmounted (it
  // just renders null while closed), so the early return has to come
  // after all of them, not in the middle.
  if (!open) return null;

  // Fast cash presets handler
  function handleSetExactCash() {
    setTenders([{ method: "cash", amount: total }]);
  }

  function handleAddCashDenomination(addAmount: number) {
    const current = Number(tenders[0]?.amount || 0);
    setTenders([{ method: "cash", amount: Math.round((current + addAmount) * 100) / 100 }]);
  }

  function handleSetRoundCash(roundTo: number) {
    const rounded = Math.ceil(total / roundTo) * roundTo;
    setTenders([{ method: "cash", amount: rounded }]);
  }

  // Render the Receipt Preview Modal overlay on successful payment completion
  if (completedTxId) {
    const tendersTotal = receiptData ? receiptData.tenders.reduce((sum: number, t: any) => sum + t.amount, 0) : 0;
    const changePaid = receiptData ? Math.max(0, tendersTotal - receiptData.total) : 0;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in print:p-0 print:bg-white backdrop-blur-xs">
        <div className="flex w-full max-w-md flex-col rounded-xl bg-zinc-50 border border-zinc-200 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden print:w-full print:border-0 print:shadow-none">
          
          <div className="flex items-center justify-between border-b bg-white px-5 py-3.5 dark:bg-zinc-950 print:hidden">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">Transaction Successful</h3>
            </div>
            <button onClick={handleNewSale} className="rounded-lg hover:bg-zinc-100 p-1.5 dark:hover:bg-zinc-800 text-zinc-500 transition">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 max-h-[68vh] flex justify-center bg-zinc-100 dark:bg-zinc-900 print:bg-white print:p-0 print:overflow-visible">
            {loadingReceipt && (
              <div className="w-full max-w-[310px] h-72 flex flex-col items-center justify-center gap-2">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
                <p className="text-xs font-bold text-zinc-500 animate-pulse">Generating receipt slip...</p>
              </div>
            )}

            {!loadingReceipt && receiptData && (
              <div className="printable-receipt bg-white text-zinc-950 border border-zinc-200 p-5 rounded-lg shadow-sm font-mono text-[11px] leading-relaxed w-[310px] select-none dark:bg-white dark:text-zinc-950 print:border-0 print:shadow-none print:w-[80mm] print:p-2">
                {/* Header */}
                <div className="text-center space-y-1 mb-3">
                  <h4 className="text-xs font-extrabold uppercase tracking-wide text-zinc-900">{receiptData.bizName || "Sales Receipt"}</h4>
                  {receiptData.locationName && <p className="text-[10px] text-zinc-600">{receiptData.locationName}</p>}
                  {receiptData.tax > 0 && receiptData.taxNo && <p className="text-[10px] font-bold text-zinc-700">TAX ID: {receiptData.taxNo}</p>}
                  <div className="pt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-zinc-100 px-2 py-0.5 rounded text-zinc-800 border border-zinc-200">
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
                        <span className="w-12 text-right font-sans font-normal text-red-600">
                          {item.discount > 0 ? `-${item.discount.toFixed(0)}` : "0.00"}
                        </span>
                        <span className="w-14 text-right font-sans tabular-nums">{lineSub.toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Totals */}
                <div className="border-t border-dashed border-zinc-300 py-2.5 space-y-1 text-zinc-800 text-[10.5px]">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-sans tabular-nums">Rs {receiptData.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax</span>
                    <span className="font-sans tabular-nums">Rs {receiptData.tax.toFixed(2)}</span>
                  </div>
                  {receiptData.shipping > 0 && (
                    <div className="flex justify-between">
                      <span>Shipping</span>
                      <span className="font-sans tabular-nums">Rs {receiptData.shipping.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-zinc-900 font-extrabold text-sm border-t border-dashed border-zinc-300 pt-2">
                    <span>TOTAL</span>
                    <span className="font-sans tabular-nums">Rs {receiptData.total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Payments */}
                <div className="border-t border-zinc-900 pt-2 pb-1.5 space-y-1 text-[10px] text-zinc-650">
                  {receiptData.tenders.map((t: any, idx: number) => (
                    <div key={idx} className="flex justify-between">
                      <span className="capitalize">{t.method} Pay:</span>
                      <span className="font-sans tabular-nums">Rs {t.amount.toFixed(2)}</span>
                    </div>
                  ))}
                  {changePaid > 0 && (
                    <div className="flex justify-between font-bold text-zinc-900">
                      <span>Change Paid:</span>
                      <span className="font-sans tabular-nums">Rs {changePaid.toFixed(2)}</span>
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
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs font-semibold hover:bg-zinc-100 text-zinc-600 transition dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-300 shrink-0"
            >
              <Printer className="h-4 w-4 text-indigo-600" />
              <span>Printer Settings</span>
            </a>

            <div className="flex items-center gap-2 flex-1 justify-end">
              <button
                onClick={() => window.print()}
                className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white transition flex items-center gap-1.5 shadow-sm"
              >
                <Printer className="h-3.5 w-3.5" />
                Print Receipt
              </button>
              <button
                onClick={handleNewSale}
                className="h-9 px-5 rounded-lg bg-indigo-650 hover:bg-indigo-750 text-xs font-bold text-white transition shadow-sm flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />
                New Sale (Esc)
              </button>
            </div>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in backdrop-blur-xs">
      <div className="flex w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 overflow-hidden md:flex-row max-h-[92vh]">
        
        {/* Left Side: Forms & Denominations */}
        <div className="flex-1 p-6 overflow-y-auto scrollbar-thin flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div>
                <h2 className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-indigo-600" /> Payment & Tender
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">Enter tender amounts or select fast cash shortcuts</p>
              </div>
              <button
                onClick={onClose}
                disabled={submitting}
                className="rounded-lg hover:bg-zinc-100 p-1.5 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
                title="Close (Esc)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Fast Cash Quick Denominations */}
            <div className="mb-5 rounded-xl bg-indigo-50/60 p-3.5 border border-indigo-100 dark:bg-indigo-950/20 dark:border-indigo-900/40">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 block mb-2">
                ⚡ Fast Cash Shortcuts:
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSetExactCash}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition"
                >
                  Exact (Rs {total.toFixed(2)})
                </button>
                <button
                  type="button"
                  onClick={() => handleSetRoundCash(100)}
                  className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-zinc-700 border border-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700 transition shadow-2xs"
                >
                  Next 100
                </button>
                <button
                  type="button"
                  onClick={() => handleSetRoundCash(500)}
                  className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-zinc-700 border border-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700 transition shadow-2xs"
                >
                  Next 500
                </button>
                <button
                  type="button"
                  onClick={() => handleSetRoundCash(1000)}
                  className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-zinc-700 border border-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700 transition shadow-2xs"
                >
                  Next 1,000
                </button>
                <button
                  type="button"
                  onClick={() => handleAddCashDenomination(500)}
                  className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-indigo-600 border border-indigo-200 hover:bg-indigo-50 dark:bg-zinc-900 dark:text-indigo-400 dark:border-zinc-700 transition shadow-2xs"
                >
                  +500
                </button>
                <button
                  type="button"
                  onClick={() => handleAddCashDenomination(1000)}
                  className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-indigo-600 border border-indigo-200 hover:bg-indigo-50 dark:bg-zinc-900 dark:text-indigo-400 dark:border-zinc-700 transition shadow-2xs"
                >
                  +1,000
                </button>
                <button
                  type="button"
                  onClick={() => handleAddCashDenomination(5000)}
                  className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-indigo-600 border border-indigo-200 hover:bg-indigo-50 dark:bg-zinc-900 dark:text-indigo-400 dark:border-zinc-700 transition shadow-2xs"
                >
                  +5,000
                </button>
              </div>
            </div>

            {/* Split Tenders */}
            <div className="space-y-3 mb-5">
              <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wide">
                Payment Breakdown
              </span>
              {tenders.map((tender, index) => (
                <div key={index} className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/60 md:flex-row md:items-center">
                  
                  {/* Payment Method Selector */}
                  <div className="w-full md:w-44 flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-zinc-500">Method</label>
                    <div className="relative">
                      <select
                        value={tender.method}
                        onChange={(e) => updateTender(index, "method", e.target.value)}
                        className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-800 capitalize"
                      >
                        <option value="cash">💵 Cash</option>
                        <option value="card">💳 Card</option>
                        <option value="wallet">📱 Digital Wallet</option>
                        <option value="gift_card">🎁 Gift Card / Voucher</option>
                      </select>
                    </div>
                  </div>

                  {/* Amount Input */}
                  <div className="flex-1 flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-zinc-500">Tender Amount (Rs)</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        autoFocus={index === 0}
                        value={tender.amount === 0 ? "" : tender.amount}
                        onChange={(e) => updateTender(index, "amount", Number(e.target.value))}
                        placeholder="0.00"
                        className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-base font-bold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-800 font-mono tabular-nums text-zinc-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Remove button */}
                  {tenders.length > 1 && (
                    <button
                      onClick={() => removePaymentRow(index)}
                      className="h-10 px-3 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400 self-end md:self-auto flex items-center justify-center transition"
                      title="Remove Row"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}

              <button
                onClick={addPaymentRow}
                className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-indigo-300 bg-indigo-50/50 px-3.5 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-400 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Split Tender Row
              </button>
            </div>

            {/* Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-500">Sell Note (Receipt):</label>
                <input
                  type="text"
                  value={sellNote}
                  onChange={(e) => setSellNote(e.target.value)}
                  placeholder="Optional customer/order memo"
                  className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-850"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-500">Staff Note (Internal):</label>
                <input
                  type="text"
                  value={staffNote}
                  onChange={(e) => setStaffNote(e.target.value)}
                  placeholder="Internal audit note"
                  className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-850"
                />
              </div>
            </div>

            {error && <p className="mt-3 text-xs font-bold text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">{error}</p>}
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
            <span>Press <kbd className="rounded border bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">Enter</kbd> to finalize</span>
            <span>Press <kbd className="rounded border bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">Esc</kbd> to return</span>
          </div>
        </div>

        {/* Right Side: Totals & Change Panel (Modern High-Contrast Navy/Indigo) */}
        <div className="w-full md:w-80 bg-zinc-900 text-white p-6 flex flex-col justify-between shrink-0 border-l border-zinc-800">
          <div className="space-y-4">
            <div className="border-b border-zinc-800 pb-3 flex justify-between items-baseline">
              <span className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">Total Items</span>
              <span className="text-xl font-bold font-mono tabular-nums">{totalItems.toFixed(0)}</span>
            </div>

            <div className="border-b border-zinc-800 pb-3 flex justify-between items-baseline">
              <span className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">Total Payable</span>
              <span className="text-2xl font-extrabold font-mono text-white tabular-nums">Rs {total.toFixed(2)}</span>
            </div>

            <div className="border-b border-zinc-800 pb-3 flex justify-between items-baseline">
              <span className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">Total Paying</span>
              <span className="text-xl font-bold font-mono text-indigo-300 tabular-nums">Rs {totalPaying.toFixed(2)}</span>
            </div>

            {/* Change Return Banner */}
            <div className={`p-4 rounded-xl transition-all ${
              changeReturn > 0
                ? "bg-emerald-950/80 border border-emerald-500 text-emerald-300"
                : "bg-zinc-800/80 border border-zinc-700 text-zinc-300"
            }`}>
              <div className="flex justify-between items-center">
                <span className="text-xs uppercase tracking-wider font-bold">Change Return</span>
                <span className="text-2xl font-black font-mono tabular-nums">Rs {changeReturn.toFixed(2)}</span>
              </div>
            </div>

            {balance > 0 && (
              <div className="p-3 rounded-lg bg-amber-950/60 border border-amber-600/50 text-amber-400 flex justify-between items-center text-xs font-bold">
                <span>Remaining Balance Due:</span>
                <span className="font-mono text-sm tabular-nums">Rs {balance.toFixed(2)}</span>
              </div>
            )}
          </div>

          <div className="mt-8 flex flex-col gap-2.5">
            <button
              disabled={submitting || totalPaying < total || total === 0}
              onClick={handleFinalize}
              className="h-12 w-full rounded-xl bg-emerald-500 hover:bg-emerald-600 text-sm font-extrabold text-white transition shadow-lg uppercase tracking-wide disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Banknote className="h-5 w-5" />
              {submitting ? "Finalizing Sale…" : `Finalize & Print (Enter)`}
            </button>
            <button
              onClick={onClose}
              disabled={submitting}
              className="h-10 w-full rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-300 transition uppercase tracking-wide disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Cancel (Esc)
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

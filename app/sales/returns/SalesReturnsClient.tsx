"use client";

import { useEffect, useState } from "react";
import { useProducts } from "@/lib/pos/use-products";
import { Modal } from "@/components/ui/modal";
import { NumberInput } from "@/components/ui/number-input";
import { priceReturn } from "@/lib/sales/return-pricing";
import { useRouter } from "next/navigation";
import { Plus, X, Search, RotateCcw, Repeat, ShieldCheck } from "lucide-react";
import { ManagerPinModal } from "@/app/_components/ManagerPinModal";

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

type ReceiptItem = { sku: string; qty: number; unitPrice: number; discount?: number; taxAmount?: number; batchNumber?: string | null; serialNumbers?: string[] | null };
type Receipt = { id: string; customerName: string | null; items: ReceiptItem[]; returnedBySku?: Record<string, number>; status: string };
type Product = { sku: string; name: string; unitPrice: number; qtyOnHand: number; trackBatch?: boolean; trackSerial?: boolean; isScaleItem?: boolean };
type ExchangeLine = { sku: string; name: string; qty: number; unitPrice: number; catalogPrice: number; trackBatch?: boolean; trackSerial?: boolean; batchNumber?: string; serialNumbers?: string[] };

export function SalesReturnsClient({
  initialReturns,
  canCreate,
}: {
  initialReturns: ReturnRow[];
  canCreate: boolean;
}) {
  const router = useRouter();
  const returns = initialReturns;
  const [modalOpen, setModalOpen] = useState(false);
  const [txId, setTxId] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [returnQty, setReturnQty] = useState<Record<string, string>>({});
  const [confirmedTrackedUnits, setConfirmedTrackedUnits] = useState(false);
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

  // "Supervisor Override" was previously just a self-service checkbox —
  // any cashier could tick it themselves with no actual manager
  // involvement. It now requires a live manager PIN, verified again
  // server-side (see handleSubmit) rather than trusted from this earlier
  // check alone.
  const [allowNonReturnableOverride, setAllowNonReturnableOverride] = useState(false);
  const [overridePin, setOverridePin] = useState<string | null>(null);
  const [overrideApprover, setOverrideApprover] = useState<string | null>(null);
  const [pinModalOpen, setPinModalOpen] = useState(false);

  function openModal() {
    setTxId("");
    setReceipt(null);
    setReturnQty({});
    setConfirmedTrackedUnits(false);
    setReason("");
    setRefundMethod("cash");
    setIsExchange(false);
    setExchangeLines([]);
    setExchangeQuery("");
    setNetPaymentMethod("cash");
    setAllowNonReturnableOverride(false);
    setOverridePin(null);
    setOverrideApprover(null);
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
    if (!receipt) return sum;
    try { return sum + priceReturn(receipt.items.filter(i => i.sku === sku), receipt.returnedBySku?.[sku] ?? 0, Number(qty || 0)).amount; }
    catch { return sum; }
  }, 0);
  const exchangeTotal = exchangeLines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);
  const trackedUnits = Object.entries(returnQty).flatMap(([sku, qty]) => {
    const lines = receipt?.items.filter(i => i.sku === sku) ?? [];
    try {
      return priceReturn(lines, receipt?.returnedBySku?.[sku] ?? 0, Number(qty || 0)).allocations.flatMap(a => {
        const line = lines[a.index];
        const serials = line.serialNumbers?.slice(a.offset, a.offset + a.qty) ?? [];
        return line.batchNumber || serials.length ? [`${sku}: ${a.qty} unit(s)${line.batchNumber ? ` from batch ${line.batchNumber}` : ""}${serials.length ? `; serials ${serials.join(", ")}` : ""}`] : [];
      });
    } catch { return []; }
  });
  const netAmount = Math.round((exchangeTotal - returnTotal) * 100) / 100;

  const productLookup = useProducts(exchangeQuery);
  const exchangeMatches = exchangeQuery.trim() ? productLookup.products.filter(p => p.qtyOnHand > 0) : [];

  function addExchangeLine(p: Product) {
    if (p.isScaleItem) { setError("Record the return, then sell the weighed replacement through POS checkout."); return; }
    setExchangeLines((prev) => {
      const existing = prev.find((l) => l.sku === p.sku);
      if (existing) return prev.map((l) => (l.sku === p.sku ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { sku: p.sku, name: p.name, qty: 1, unitPrice: p.unitPrice, catalogPrice: p.unitPrice, trackBatch: p.trackBatch, trackSerial: p.trackSerial }];
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
      setConfirmedTrackedUnits(false);
      setReturnQty(Object.fromEntries(body.data.items.map((i: ReceiptItem) => [i.sku, "0"])));
    } catch { setError("Could not look up the sale. Check your connection and retry.");
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
          confirmedTrackedUnits,
          allowNonReturnableOverride,
          managerPin: allowNonReturnableOverride ? overridePin : undefined,
          exchangeItems: isExchange ? exchangeLines.map((l) => ({ sku: l.sku, qty: l.qty, batchNumber: l.batchNumber, serialNumbers: l.serialNumbers })) : undefined,
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
    } catch { setError("Could not save the return. Check its status before retrying.");
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
        <Modal open={modalOpen} onClose={() => setModalOpen(false)} closeDisabled={submitting} title="New Sales Return" unstyled className="max-w-2xl">
          <div className="bg-white rounded-lg border border-zinc-200 shadow-xl max-w-2xl w-full p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm text-zinc-800">New Sales Return</h3>
              <button aria-label="Close return" disabled={submitting} onClick={() => setModalOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            {error && <p role="alert" className="text-xs text-red-600 font-semibold">{error}</p>}

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
                  <p className="text-[12px] text-zinc-450 mt-1">
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
                  {[...new Set(receipt.items.map(i => i.sku))].map((sku) => {
                    const matching = receipt.items.filter(i => i.sku === sku);
                    const item = { ...matching[0], qty: matching.reduce((n, i) => n + i.qty, 0) };
                    const remaining = item.qty - (receipt.returnedBySku?.[sku] ?? 0);
                    const prodMatch = products.find((p) => p.sku === item.sku);
                    const isNonReturnable = (prodMatch as { isReturnable?: boolean } | undefined)?.isReturnable === false;

                    return (
                      <div key={item.sku} className="flex items-center justify-between gap-3 px-3 py-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-bold text-zinc-800">{item.sku}</p>
                            {isNonReturnable && (
                              <span className="rounded bg-amber-100 text-amber-800 text-[12px] px-1.5 py-0.5 font-bold">
                                Final Sale
                              </span>
                            )}
                          </div>
                          <p className="text-[12px] text-zinc-450">Sold: {item.qty} ? Remaining: {remaining} · Rs {item.unitPrice.toFixed(2)} each</p>
                        </div>
                        <input
                          type="number"
                          min="0"
                          aria-label={`Return quantity for ${item.sku}`}
                          step="1"
                          max={remaining}
                          value={returnQty[item.sku] ?? "0"}
                          onChange={(e) => { setConfirmedTrackedUnits(false); setReturnQty((prev) => ({ ...prev, [item.sku]: e.target.value })); }}
                          className="h-8 w-20 rounded border border-zinc-300 px-2 text-center text-xs font-mono outline-none focus:border-indigo-500"
                        />
                      </div>
                    );
                  })}
                </div>

                {trackedUnits.length > 0 && (
                  <div className="rounded border border-indigo-200 p-3 space-y-2 text-xs">
                    <p className="font-bold">Units to return (receipt order)</p>
                    {trackedUnits.map((description, i) => <p key={i}>{description}</p>)}
                    <label className="flex gap-2 items-center">
                      <input type="checkbox" required checked={confirmedTrackedUnits} onChange={e => setConfirmedTrackedUnits(e.target.checked)} />
                      I checked that the returned units match these batches and serial numbers.
                    </label>
                  </div>
                )}

                {allowNonReturnableOverride ? (
                  <div className="flex items-center justify-between gap-2 rounded-md border border-emerald-200 bg-emerald-50/50 px-3 py-2 text-xs font-semibold text-emerald-800">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Final Sale override authorized by {overrideApprover}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setAllowNonReturnableOverride(false);
                        setOverridePin(null);
                        setOverrideApprover(null);
                      }}
                      className="text-emerald-700 hover:text-emerald-900 underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPinModalOpen(true)}
                    className="flex w-full items-center gap-2 rounded-md border border-amber-200 bg-amber-50/50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Supervisor Override: Allow return for Final Sale / Non-Returnable items (requires manager PIN)
                  </button>
                )}

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
                              <p className="text-[12px] text-zinc-450">Rs {l.unitPrice.toFixed(2)} each</p>
                              <ExchangeTracking line={l} onChange={patch => setExchangeLines(prev => prev.map(row => row.sku === l.sku ? { ...row, ...patch } : row))} />
                            </div>
                            <div className="flex items-center gap-2">
                              <NumberInput min={1} integer aria-label={"Exchange quantity for " + l.name} value={l.qty} onValueChange={(value) => setExchangeQty(l.sku, value)}
                                className="h-8 w-16 rounded border border-zinc-300 px-2 text-center text-xs font-mono outline-none focus:border-indigo-500"
                              />
                              <button type="button" aria-label={"Remove " + l.name} onClick={() => setExchangeQty(l.sku, 0)} className="text-red-500 hover:text-red-700">
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
                  <input aria-label="Reason"
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Damaged, wrong item, customer changed mind"
                    className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-650 mb-1">Refund Method</label>
                  <select aria-label="Refund Method"
                    value={refundMethod}
                    onChange={(e) => setRefundMethod(e.target.value)}
                    className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500"
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="store_credit">Store Credit</option>
                  </select>
                  {refundMethod === "store_credit" && !isExchange && (
                    (!receipt.customerName || receipt.customerName === "Walk-In") ? (
                      <p className="text-[12px] text-red-600 font-semibold mt-1">
                        This sale has no registered customer — store credit needs one to issue a credit note to. Pick Cash or Card instead, or process this on a Walk-In sale associated with a customer.
                      </p>
                    ) : (
                      <p className="text-[12px] text-zinc-450 mt-1">
                        Issues a Rs {returnTotal.toFixed(2)} credit note to {receipt.customerName}, redeemable on their next purchase.
                      </p>
                    )
                  )}
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
        </Modal>
      )}

      <ManagerPinModal
        open={pinModalOpen}
        title="Authorize Final Sale Return"
        description="A manager or admin must enter their PIN, or scan their access card, to allow returning a Final Sale item"
        onClose={() => setPinModalOpen(false)}
        onSuccess={({ approverName, pin }) => {
          setAllowNonReturnableOverride(true);
          setOverridePin(pin);
          setOverrideApprover(approverName);
          setPinModalOpen(false);
        }}
      />

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
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-650 text-[12px] font-bold uppercase">
                        <Repeat className="h-2.5 w-2.5" /> Exchange
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 text-[12px] font-bold uppercase">
                        Return
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 font-mono text-zinc-500 text-[12px]">{r.transactionId.slice(0, 12)}…</td>
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

function ExchangeTracking({ line, onChange }: { line: ExchangeLine; onChange: (patch: Partial<ExchangeLine>) => void }) {
  const [batches, setBatches] = useState<{ batchNumber: string; qtyOnHand: number; unitPrice: number | null; expiryDate: string | null }[]>([]);
  const [error, setError] = useState("");
  const [serialText, setSerialText] = useState("");
  useEffect(() => {
    if (!line.trackBatch) return;
    const controller = new AbortController();
    fetch(`/api/inventory/${encodeURIComponent(line.sku)}/batches`, { signal: controller.signal })
      .then(r => r.json()).then(body => {
        if (!body.success) throw new Error(body.error?.message ?? "Could not load batches");
        setBatches(body.data.filter((b: { expiryDate: string | null }) => !b.expiryDate || new Date(b.expiryDate) > new Date()));
      }).catch(err => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [line.sku, line.trackBatch]);
  return <div className="space-y-1 mt-1">
    {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    {line.trackBatch && <select required aria-label={`Replacement batch for ${line.name}`} value={line.batchNumber ?? ""}
      onChange={e => { const batch = batches.find(b => b.batchNumber === e.target.value); onChange({ batchNumber: batch?.batchNumber, unitPrice: batch?.unitPrice ?? line.catalogPrice }); }}
      className="w-full rounded border border-zinc-300 p-1 text-xs">
      <option value="">Select replacement batch</option>
      {batches.map(b => <option key={b.batchNumber} value={b.batchNumber}>{b.batchNumber} ({b.qtyOnHand} available)</option>)}
    </select>}
    {line.trackSerial && <label className="block text-xs">Replacement serials (one per line)
      <textarea required aria-label={`Replacement serials for ${line.name}`} value={serialText}
        onChange={e => { setSerialText(e.target.value); onChange({ serialNumbers: e.target.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean) }); }}
        className="block w-full rounded border border-zinc-300 p-1" />
    </label>}
  </div>;
}

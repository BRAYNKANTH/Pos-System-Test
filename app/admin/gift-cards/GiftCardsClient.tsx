"use client";

import React, { useState, useEffect } from "react";
import { Gift, Plus, Search, Printer, Calendar, CreditCard, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";

interface GiftCard {
  id: string;
  code: string;
  initialBalance: number;
  currentBalance: number;
  status: string;
  notes?: string;
  expiresAt?: string;
  createdAt: string;
}

export default function GiftCardsClient() {
  const [giftCards, setGiftCards] = useState<GiftCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form states
  const [amount, setAmount] = useState("1000");
  const [customCode, setCustomCode] = useState("");
  const [notes, setNotes] = useState("");
  const [expiresDays, setExpiresDays] = useState("365");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Selected card for print slip preview
  const [printCard, setPrintCard] = useState<GiftCard | null>(null);

  const fetchGiftCards = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/gift-cards?query=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setGiftCards(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGiftCards();
  }, [query]);

  const handleCreateGiftCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/admin/gift-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount),
          customCode: customCode ? customCode.trim() : undefined,
          notes,
          expiresDays: Number(expiresDays),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setFormError(data.error?.message || "Failed to create gift card");
        return;
      }

      setShowCreateModal(false);
      setAmount("1000");
      setCustomCode("");
      setNotes("");
      fetchGiftCards();
      setPrintCard(data.data);
    } catch (err: any) {
      setFormError(err.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2.5">
            <Gift className="h-6 w-6 text-indigo-600" /> Gift Cards & Store Vouchers
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Issue digital vouchers, track remaining balances, and redeem gift cards at POS checkout.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowCreateModal(true)}
            className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2 transition shadow-sm"
          >
            <Plus className="h-4 w-4" /> Issue Gift Card
          </button>
        </div>
      </div>

      {/* Search & Stats Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="h-4 w-4 text-zinc-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by code or note..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-10 w-full pl-9 pr-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850 text-xs font-semibold outline-none focus:border-indigo-500 transition"
          />
        </div>

        <div className="flex items-center gap-4 text-xs font-bold text-zinc-600 dark:text-zinc-400">
          <span>Total Active: {giftCards.filter((g) => g.status === "active").length}</span>
          <span>Redeemed: {giftCards.filter((g) => g.status === "redeemed").length}</span>
        </div>
      </div>

      {/* Gift Cards Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-50 dark:bg-zinc-850 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 font-extrabold uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Voucher Code</th>
                <th className="px-5 py-3.5">Initial Value</th>
                <th className="px-5 py-3.5">Current Balance</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Expires</th>
                <th className="px-5 py-3.5">Created</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-semibold text-zinc-800 dark:text-zinc-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-zinc-400">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-indigo-600" />
                    Loading gift cards...
                  </td>
                </tr>
              ) : giftCards.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-zinc-400">
                    No gift cards found. Click "Issue Gift Card" to create one.
                  </td>
                </tr>
              ) : (
                giftCards.map((card) => {
                  const isDepleted = card.currentBalance <= 0;
                  return (
                    <tr key={card.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-850/50 transition">
                      <td className="px-5 py-4 font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                        {card.code}
                      </td>
                      <td className="px-5 py-4 font-mono">
                        Rs {Number(card.initialBalance).toFixed(2)}
                      </td>
                      <td className="px-5 py-4 font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                        Rs {Number(card.currentBalance).toFixed(2)}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase border ${
                            card.status === "active" && !isDepleted
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400"
                              : "bg-zinc-100 text-zinc-600 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400"
                          }`}
                        >
                          {isDepleted ? "Depleted" : card.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-zinc-500">
                        {card.expiresAt ? new Date(card.expiresAt).toLocaleDateString() : "Never"}
                      </td>
                      <td className="px-5 py-4 text-zinc-500">
                        {new Date(card.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => setPrintCard(card)}
                          className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-bold transition inline-flex items-center gap-1.5"
                        >
                          <Printer className="h-3.5 w-3.5 text-indigo-600" /> Slip
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Issue Gift Card */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5">
            <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="font-extrabold text-base text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Gift className="h-5 w-5 text-indigo-600" /> Issue Gift Voucher
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-zinc-400 hover:text-zinc-600">✕</button>
            </div>

            <form onSubmit={handleCreateGiftCard} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-zinc-600 dark:text-zinc-400">Card Amount (Rs):</label>
                <input
                  type="number"
                  required
                  min="50"
                  step="50"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-10 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 px-3 font-mono font-bold text-base outline-none focus:border-indigo-500 bg-white dark:bg-zinc-900"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-zinc-600 dark:text-zinc-400">Custom Code (Optional):</label>
                <input
                  type="text"
                  placeholder="Leave blank for auto-generated code"
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                  className="h-10 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 px-3 font-mono font-bold uppercase outline-none focus:border-indigo-500 bg-white dark:bg-zinc-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-zinc-600 dark:text-zinc-400">Valid Days:</label>
                  <input
                    type="number"
                    value={expiresDays}
                    onChange={(e) => setExpiresDays(e.target.value)}
                    className="h-10 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 px-3 font-bold outline-none focus:border-indigo-500 bg-white dark:bg-zinc-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-zinc-600 dark:text-zinc-400">Notes / Recipient:</label>
                  <input
                    type="text"
                    placeholder="Customer name"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="h-10 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 px-3 font-semibold outline-none focus:border-indigo-500 bg-white dark:bg-zinc-900"
                  />
                </div>
              </div>

              {formError && (
                <p className="text-xs font-bold text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
                  {formError}
                </p>
              )}

              <div className="pt-3 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="h-10 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold transition shadow-md disabled:opacity-50"
                >
                  {submitting ? "Issuing..." : "Create Voucher"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Slip Preview */}
      {printCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in print:p-0 print:bg-white">
          <div className="bg-white rounded-2xl border border-zinc-200 p-6 w-full max-w-sm shadow-2xl space-y-4 print:border-0 print:shadow-none print:w-full">
            <div className="text-center space-y-1 border-b border-dashed border-zinc-300 pb-3">
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-indigo-700">GIFT VOUCHER</h3>
              <p className="text-xs font-mono font-bold text-zinc-900">{printCard.code}</p>
            </div>

            <div className="py-4 text-center space-y-2">
              <span className="text-xs uppercase text-zinc-400 font-bold">Voucher Value</span>
              <p className="text-3xl font-black font-mono text-zinc-900">
                Rs {Number(printCard.initialBalance).toFixed(2)}
              </p>
              {printCard.notes && <p className="text-xs text-zinc-500">Issued to: {printCard.notes}</p>}
              <p className="text-[11px] text-zinc-400">
                Valid until: {printCard.expiresAt ? new Date(printCard.expiresAt).toLocaleDateString() : "No expiry"}
              </p>
            </div>

            <div className="border-t border-dashed border-zinc-300 pt-3 text-center text-[10px] text-zinc-400">
              Present this voucher code at POS checkout to redeem balance.
            </div>

            <div className="flex justify-between items-center pt-2 print:hidden">
              <button
                onClick={() => setPrintCard(null)}
                className="h-9 px-3 rounded-lg border border-zinc-200 text-xs font-bold hover:bg-zinc-100"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Printer className="h-3.5 w-3.5" /> Print Voucher Slip
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

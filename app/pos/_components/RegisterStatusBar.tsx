"use client";

import { useEffect, useState } from "react";
import { Lock, Unlock, PlusCircle, MinusCircle, X, Eye, Printer } from "lucide-react";
import { RegisterSummaryReport, type RegisterSummary } from "./RegisterSummaryReport";

type RegisterSession = {
  id: string;
  openingFloat: string | number;
  openedAt: string;
  openedBy: { name: string };
};

export function RegisterStatusBar() {
  const [session, setSession] = useState<RegisterSession | null | undefined>(undefined);
  const [openModalOpen, setOpenModalOpen] = useState(false);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [cashModalOpen, setCashModalOpen] = useState<"in" | "out" | null>(null);
  const [openingFloat, setOpeningFloat] = useState("");
  const [closingCount, setClosingCount] = useState("");
  const [closeNotes, setCloseNotes] = useState("");
  const [cashAmount, setCashAmount] = useState("");
  const [cashReason, setCashReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Live "Current Register" view — the reconciliation breakdown, viewable
  // any time while the till is open, not just at close.
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [summary, setSummary] = useState<RegisterSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Shown once a close actually succeeds — the full report with the
  // recorded closing count + cash difference, instead of a plain alert().
  const [closedSummary, setClosedSummary] = useState<RegisterSummary | null>(null);

  async function fetchSummary(sessionId: string) {
    setSummaryLoading(true);
    try {
      const res = await fetch(`/api/pos/register/${sessionId}/summary`);
      const body = await res.json();
      if (body.success) setSummary(body.data);
    } finally {
      setSummaryLoading(false);
    }
  }

  async function refresh() {
    try {
      const res = await fetch("/api/pos/register");
      const body = await res.json();
      if (body.success) setSession(body.data);
    } catch {
      setSession(null);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleOpen(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/pos/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openingFloat: Number(openingFloat) || 0 }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Failed to open register");
        return;
      }
      setOpenModalOpen(false);
      setOpeningFloat("");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleClose(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/pos/register/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, closingCount: Number(closingCount) || 0, notes: closeNotes }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Failed to close register");
        return;
      }
      setCloseModalOpen(false);
      setClosingCount("");
      setCloseNotes("");
      const closedSessionId = session.id;
      await refresh();
      // Full report with the just-recorded closing count + cash
      // difference, not a plain alert() — matches the reconciliation
      // detail the cashier already saw before entering their count.
      setSummaryLoading(true);
      const summaryRes = await fetch(`/api/pos/register/${closedSessionId}/summary`);
      const summaryBody = await summaryRes.json();
      setSummaryLoading(false);
      if (summaryBody.success) setClosedSummary(summaryBody.data);
    } finally {
      setBusy(false);
    }
  }

  function openCloseModal() {
    if (!session) return;
    setCloseModalOpen(true);
    fetchSummary(session.id);
  }

  function openViewModal() {
    if (!session) return;
    setViewModalOpen(true);
    fetchSummary(session.id);
  }

  async function handleCashMovement(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !cashModalOpen) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/pos/register/cash-movement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          type: cashModalOpen,
          amount: Number(cashAmount) || 0,
          reason: cashReason,
        }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Failed to record cash movement");
        return;
      }
      setCashModalOpen(null);
      setCashAmount("");
      setCashReason("");
    } finally {
      setBusy(false);
    }
  }

  if (session === undefined) return null;

  return (
    <>
      {session ? (
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1.5 bg-green-50 text-green-700 px-2.5 py-1.5 rounded text-xs font-bold dark:bg-green-950/30 dark:text-green-400">
            <Unlock className="h-3.5 w-3.5" /> Register Open
          </div>
          <button
            onClick={openViewModal}
            className="flex h-9 w-9 items-center justify-center rounded border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-650 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 transition"
            title="View Current Register"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCashModalOpen("in")}
            className="flex h-9 w-9 items-center justify-center rounded border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-650 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 transition"
            title="Cash In"
          >
            <PlusCircle className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCashModalOpen("out")}
            className="flex h-9 w-9 items-center justify-center rounded border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-650 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 transition"
            title="Cash Out"
          >
            <MinusCircle className="h-4 w-4" />
          </button>
          <button
            onClick={openCloseModal}
            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-xs font-bold transition"
          >
            Close Register
          </button>
        </div>
      ) : (
        <button
          onClick={() => setOpenModalOpen(true)}
          className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 px-3 py-1.5 rounded text-xs font-bold transition dark:bg-amber-950/30 dark:text-amber-400"
        >
          <Lock className="h-3.5 w-3.5" /> Open Register
        </button>
      )}

      {openModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-lg border border-zinc-200 shadow-xl max-w-xs w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm text-zinc-800">Open Register</h3>
              <button onClick={() => setOpenModalOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}
            <form onSubmit={handleOpen} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-650 mb-1">Opening Float</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  autoFocus
                  required
                  value={openingFloat}
                  onChange={(e) => setOpeningFloat(e.target.value)}
                  className="h-9 w-full rounded border border-zinc-300 px-3 text-sm font-mono outline-none focus:border-indigo-500"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-bold shadow-sm transition disabled:opacity-50"
              >
                {busy ? "Opening..." : "Open Register"}
              </button>
            </form>
          </div>
        </div>
      )}

      {closeModalOpen && session && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-150 dark:border-zinc-800 px-5 py-3 shrink-0">
              <h3 className="font-bold text-sm text-zinc-800 dark:text-zinc-200">Close Register</h3>
              <button onClick={() => { setCloseModalOpen(false); setSummary(null); }} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            <div className="overflow-y-auto p-5 space-y-4">
              {summaryLoading && !summary && (
                <p className="text-xs text-zinc-500 py-8 text-center">Loading register summary…</p>
              )}
              {summary && <RegisterSummaryReport title="Current Register" summary={summary} />}

              {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}
              <form onSubmit={handleClose} className="space-y-3 border-t border-zinc-150 dark:border-zinc-800 pt-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-650 dark:text-zinc-400 mb-1">Actual Cash Counted</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    autoFocus
                    required
                    value={closingCount}
                    onChange={(e) => setClosingCount(e.target.value)}
                    className="h-9 w-full rounded border border-zinc-300 dark:border-zinc-700 px-3 text-sm font-mono outline-none focus:border-indigo-500 dark:bg-zinc-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-650 dark:text-zinc-400 mb-1">Notes (optional)</label>
                  <input
                    value={closeNotes}
                    onChange={(e) => setCloseNotes(e.target.value)}
                    className="h-9 w-full rounded border border-zinc-300 dark:border-zinc-700 px-3 text-sm outline-none focus:border-indigo-500 dark:bg-zinc-900"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold shadow-sm transition disabled:opacity-50"
                >
                  {busy ? "Closing..." : "Close Register"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Live "Current Register" view — same report, viewable any time the
          till is open, without closing it. */}
      {viewModalOpen && session && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-150 dark:border-zinc-800 px-5 py-3 shrink-0">
              <h3 className="font-bold text-sm text-zinc-800 dark:text-zinc-200">Current Register</h3>
              <button onClick={() => { setViewModalOpen(false); setSummary(null); }} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            <div className="overflow-y-auto p-5 space-y-4">
              {summaryLoading && !summary && (
                <p className="text-xs text-zinc-500 py-8 text-center">Loading register summary…</p>
              )}
              {summary && <RegisterSummaryReport title="Current Register" summary={summary} />}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-zinc-150 dark:border-zinc-800 px-5 py-3 shrink-0 print:hidden">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-indigo-650 hover:bg-indigo-750 text-white text-xs font-bold transition"
              >
                <Printer className="h-3.5 w-3.5" /> Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shown right after a successful close — the recorded closing
          count + cash difference, plus print options. */}
      {closedSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-150 dark:border-zinc-800 px-5 py-3 shrink-0">
              <h3 className="font-bold text-sm text-zinc-800 dark:text-zinc-200">Register Details</h3>
              <button onClick={() => setClosedSummary(null)} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            <div className="overflow-y-auto p-5 space-y-4">
              <RegisterSummaryReport title="Register Details" summary={closedSummary} />
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-zinc-150 dark:border-zinc-800 px-5 py-3 shrink-0 print:hidden">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-indigo-650 hover:bg-indigo-750 text-white text-xs font-bold transition"
              >
                <Printer className="h-3.5 w-3.5" /> Print
              </button>
              <button
                onClick={() => setClosedSummary(null)}
                className="h-9 px-4 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {cashModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-lg border border-zinc-200 shadow-xl max-w-xs w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm text-zinc-800">{cashModalOpen === "in" ? "Cash In" : "Cash Out"}</h3>
              <button onClick={() => setCashModalOpen(null)} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}
            <form onSubmit={handleCashMovement} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-650 mb-1">Amount</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  autoFocus
                  required
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  className="h-9 w-full rounded border border-zinc-300 px-3 text-sm font-mono outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-650 mb-1">Reason</label>
                <input
                  required
                  value={cashReason}
                  onChange={(e) => setCashReason(e.target.value)}
                  placeholder={cashModalOpen === "in" ? "e.g. Change float top-up" : "e.g. Petty cash payout"}
                  className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full py-2 bg-indigo-650 hover:bg-indigo-750 text-white rounded text-xs font-bold shadow-sm transition disabled:opacity-50"
              >
                {busy ? "Saving..." : "Confirm"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

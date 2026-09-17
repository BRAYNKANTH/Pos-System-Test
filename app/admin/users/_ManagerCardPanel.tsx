"use client";

import { useState } from "react";
import Barcode from "react-barcode";
import { ScanBarcode, Printer, AlertTriangle } from "lucide-react";

interface ManagerCardPanelProps {
  userId: string;
  userName: string;
  role: string;
  hasCardCode: boolean;
  onCardChange: (hasCardCode: boolean) => void;
}

// Issue/reissue/revoke a manager's physical access card — the barcode
// scanned at the POS in place of typing a PIN (see ManagerPinModal and
// lib/auth/managerPin.ts). Only shown for Admin/Manager accounts: those
// are the only roles verifyManagerPin will ever authorize a scan for,
// same restriction the issuing API enforces server-side.
export function ManagerCardPanel({ userId, userName, role, hasCardCode, onCardChange }: ManagerCardPanelProps) {
  const [revealedCode, setRevealedCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (role !== "ADMIN" && role !== "MANAGER") return null;

  async function issueCard() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${userId}/card`, { method: "POST" });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Failed to issue card");
        return;
      }
      setRevealedCode(body.data.cardCode);
      onCardChange(true);
    } finally {
      setBusy(false);
    }
  }

  async function revokeCard() {
    if (!confirm(`Revoke ${userName}'s access card? The physical card will stop working immediately.`)) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${userId}/card`, { method: "DELETE" });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Failed to revoke card");
        return;
      }
      setRevealedCode(null);
      onCardChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ScanBarcode className="h-4 w-4 text-indigo-600" />
        <span className="text-xs font-extrabold text-zinc-800 uppercase tracking-wider">Manager Access Card</span>
      </div>
      <p className="text-[11px] text-zinc-450 leading-relaxed">
        Scanned at the register in place of a manager PIN — lets{" "}
        {userName || "this user"} authorize a cashier-facing override (a price change, a Final-Sale return, etc.)
        by scanning their card instead of typing a PIN.
      </p>

      {error && <p className="text-xs font-semibold text-red-600">{error}</p>}

      {revealedCode ? (
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-[11px] font-semibold text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>This code is shown once. Print the card now — it can&apos;t be displayed again (reissue for a new one if it&apos;s lost).</span>
          </div>

          <div className="printable-card flex flex-col items-center gap-1 rounded-md border border-zinc-200 bg-white p-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Manager Access Card</span>
            <span className="text-sm font-extrabold text-zinc-900">{userName}</span>
            <span className="text-[10px] font-semibold text-zinc-500 capitalize mb-1">{role.toLowerCase()}</span>
            <Barcode
              value={revealedCode}
              format="CODE128"
              width={1.4}
              height={40}
              displayValue={true}
              fontSize={10}
              textMargin={2}
              margin={0}
              background="transparent"
              lineColor="#000000"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-650 hover:bg-indigo-750 text-white rounded text-xs font-bold shadow-sm transition"
            >
              <Printer className="h-3.5 w-3.5" /> Print Card
            </button>
            <button
              type="button"
              onClick={() => setRevealedCode(null)}
              className="px-3.5 py-1.5 border border-zinc-300 rounded text-xs font-bold text-zinc-600 hover:bg-zinc-50 transition"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-zinc-600">
            {hasCardCode ? "A card is issued for this user." : "No card issued yet."}
          </span>
          <div className="flex gap-2">
            {hasCardCode && (
              <button
                type="button"
                disabled={busy}
                onClick={revokeCard}
                className="px-3 py-1.5 border border-red-200 text-red-650 hover:bg-red-50 rounded text-xs font-bold transition disabled:opacity-50"
              >
                Revoke
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={issueCard}
              className="px-3.5 py-1.5 bg-indigo-650 hover:bg-indigo-750 text-white rounded text-xs font-bold shadow-sm transition disabled:opacity-50"
            >
              {busy ? "Working…" : hasCardCode ? "Reissue Card" : "Issue Card"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

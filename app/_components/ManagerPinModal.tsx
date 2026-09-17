"use client";
import { useEffect, useRef, useState } from "react";
import { ScanBarcode } from "lucide-react";
import { Modal } from "@/components/ui/modal";

interface ManagerPinModalProps {
  open: boolean; title?: string; description?: string;
  onSuccess: (info: { approverName: string; role: string; pin: string; via: "pin" | "card" }) => void; onClose: () => void;
}

// Accepts either a typed 4-6 digit manager PIN or a manager's access
// card scanned at the register — both are just digit strings landing in
// the same field (see lib/auth/managerPin.ts, which checks pinCode and
// cardCode together). A barcode scanner in the near-universal "keyboard
// wedge" mode types the code's digits into whatever's focused and then
// sends Enter, which this input already submits on via the surrounding
// <form> — no separate "scan mode" needed, just a field long/fast enough
// to take a 12-digit card code instead of just a short PIN.
export function ManagerPinModal({ open, title = "Manager Authorization Required", description = "Enter a manager PIN, or scan a manager's access card", onSuccess, onClose }: ManagerPinModalProps) {
  const [pin, setPin] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const busy = useRef(false);
  useEffect(() => { if (open) { setPin(""); setError(""); } }, [open]);
  async function verify() {
    if (busy.current || !/^\d{4,20}$/.test(pin)) return;
    busy.current = true; setLoading(true); setError("");
    try {
      const res = await fetch('/api/auth/verify-pin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.error?.message || 'Authorization failed');
      onSuccess({ approverName: body.data.approverName, role: body.data.role, pin, via: body.data.via });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not connect. Try again.'); }
    finally { busy.current = false; setLoading(false); }
  }
  return <Modal open={open} onClose={onClose} title={title} closeDisabled={loading}>
    <form onSubmit={(e) => { e.preventDefault(); void verify(); }} className="space-y-4">
      <p className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
        <ScanBarcode className="h-4 w-4 text-indigo-600 shrink-0" /> {description}
      </p>
      <label className="block">Manager PIN or Card<input aria-label="Manager PIN or Card" type="password" inputMode="numeric" autoComplete="off" autoFocus
        value={pin} maxLength={20} pattern="[0-9]{4,20}" required disabled={loading}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 20))}
        className="mt-2 h-12 w-full rounded border px-3 text-lg font-mono" /></label>
      {error && <p role="alert" className="text-red-700 dark:text-red-300">{error}</p>}
      <div className="grid grid-cols-3 gap-2">{['1','2','3','4','5','6','7','8','9','0'].map((digit) =>
        <button key={digit} type="button" disabled={loading || pin.length >= 6} className="h-12 rounded border text-lg" onClick={() => setPin((s) => s + digit)}>{digit}</button>)}
        <button type="button" disabled={loading} onClick={() => setPin((s) => s.slice(0, -1))}>Delete digit</button>
        <button type="button" disabled={loading} onClick={() => setPin('')}>Clear</button>
      </div>
      <div className="flex gap-3"><button type="submit" disabled={loading || pin.length < 4} className="rounded bg-indigo-700 px-4 py-3 text-white disabled:opacity-50">{loading ? 'Checking?' : 'Authorize'}</button>
        <button type="button" disabled={loading} onClick={onClose} className="rounded border px-4 py-3">Cancel</button></div>
    </form>
  </Modal>;
}

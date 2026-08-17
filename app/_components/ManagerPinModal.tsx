"use client";

import React, { useState, useEffect } from "react";
import { ShieldAlert, KeyRound, X, CheckCircle2, Delete } from "lucide-react";

interface ManagerPinModalProps {
  open: boolean;
  title?: string;
  description?: string;
  onSuccess: (approverInfo: { approverName: string; role: string }) => void;
  onClose: () => void;
}

export function ManagerPinModal({
  open,
  title = "Manager Authorization Required",
  description = "Enter a Manager or Admin PIN code to authorize this action",
  onSuccess,
  onClose,
}: ManagerPinModalProps) {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPin("");
      setError(null);
      setSuccessMsg(null);
      setLoading(false);
    }
  }, [open]);

  // Handle physical keypresses
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) {
        onClose();
      } else if (e.key === "Backspace") {
        setPin((prev) => prev.slice(0, -1));
        setError(null);
      } else if (/^[0-9]$/.test(e.key)) {
        if (pin.length < 6) {
          const newPin = pin + e.key;
          setPin(newPin);
          setError(null);
        }
      } else if (e.key === "Enter") {
        if (pin.length >= 4) {
          verifyPin(pin);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, pin, loading]);

  if (!open) return null;

  async function verifyPin(pinToTest: string) {
    if (pinToTest.length < 4) {
      setError("PIN must be at least 4 digits");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinToTest }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error?.message || "Invalid Manager PIN code");
        setPin("");
        return;
      }

      setSuccessMsg(`Authorized by ${data.data.approverName}`);
      setTimeout(() => {
        onSuccess({
          approverName: data.data.approverName,
          role: data.data.role,
        });
      }, 400);
    } catch (err: any) {
      setError("Network error validating PIN");
      setPin("");
    } finally {
      setLoading(false);
    }
  }

  function handleDigitClick(digit: string) {
    if (loading || pin.length >= 6) return;
    const newPin = pin + digit;
    setPin(newPin);
    setError(null);

    // Auto verify if 4 or 6 digits reached
    if (newPin.length === 4 || newPin.length === 6) {
      verifyPin(newPin);
    }
  }

  function handleClear() {
    setPin("");
    setError(null);
  }

  function handleBackspace() {
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in backdrop-blur-xs">
      <div className="flex w-full max-w-sm flex-col rounded-2xl bg-white shadow-2xl dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 bg-amber-500/10 px-5 py-4 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{title}</h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{description}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* PIN Display */}
        <div className="p-6 text-center space-y-4">
          <div className="flex justify-center items-center gap-3">
            {[0, 1, 2, 3, 4, 5].map((idx) => {
              const filled = idx < pin.length;
              return (
                <div
                  key={idx}
                  className={`h-4 w-4 rounded-full border-2 transition-all duration-200 ${
                    filled
                      ? "bg-amber-500 border-amber-500 scale-110 shadow-sm"
                      : "border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-850"
                  }`}
                />
              );
            })}
          </div>

          {error && (
            <p className="text-xs font-bold text-red-600 dark:text-red-400 animate-shake">
              {error}
            </p>
          )}

          {successMsg && (
            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1">
              <CheckCircle2 className="h-4 w-4" /> {successMsg}
            </p>
          )}

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-2.5 pt-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleDigitClick(digit)}
                disabled={loading}
                className="h-12 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-lg font-bold text-zinc-800 dark:text-zinc-100 hover:bg-amber-50 hover:border-amber-300 dark:hover:bg-zinc-800 transition active:scale-95 disabled:opacity-50"
              >
                {digit}
              </button>
            ))}

            <button
              type="button"
              onClick={handleClear}
              disabled={loading || !pin}
              className="h-12 rounded-xl bg-zinc-100 dark:bg-zinc-850 text-xs font-bold text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition active:scale-95 disabled:opacity-40"
            >
              Clear
            </button>

            <button
              type="button"
              onClick={() => handleDigitClick("0")}
              disabled={loading}
              className="h-12 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-lg font-bold text-zinc-800 dark:text-zinc-100 hover:bg-amber-50 hover:border-amber-300 dark:hover:bg-zinc-800 transition active:scale-95 disabled:opacity-50"
            >
              0
            </button>

            <button
              type="button"
              onClick={handleBackspace}
              disabled={loading || !pin}
              className="h-12 rounded-xl bg-zinc-100 dark:bg-zinc-850 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition flex items-center justify-center active:scale-95 disabled:opacity-40"
            >
              <Delete className="h-5 w-5" />
            </button>
          </div>

          <div className="pt-2 flex justify-between text-[11px] text-zinc-400">
            <span>Default PIN: <code className="font-bold text-amber-600">1234</code></span>
            <span>Esc to cancel</span>
          </div>
        </div>

      </div>
    </div>
  );
}

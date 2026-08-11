"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

// Quick void — a single-action variant of the re-auth pattern in
// ApprovalActions.tsx (that component is Approve/Reject-shaped; void is
// just one destructive action, so it gets its own small component rather
// than overloading that one).
export function VoidSaleButton({ transactionId }: { transactionId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function close() {
    setOpen(false);
    setPassword("");
    setError(null);
  }

  async function handleVoid() {
    if (!password) {
      setError("Password is required");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const reauth = await fetch("/api/auth/admin-reauth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const reauthBody = await reauth.json();
      if (!reauthBody.success) {
        setError(reauthBody.error?.message ?? "Incorrect password");
        return;
      }

      const res = await fetch(`/api/pos/void/${transactionId}`, { method: "POST" });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Void failed");
        return;
      }
      close();
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        Void sale
      </Button>

      <Modal open={open} onClose={close} title="Void sale">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-zinc-500">
            This restores the sold items to stock and marks the sale voided. Re-enter your
            password to confirm.
          </p>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="h-9 rounded-md border border-zinc-200 bg-transparent px-3 text-sm outline-none dark:border-zinc-800"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button variant="destructive" onClick={handleVoid} disabled={submitting}>
              {submitting ? "Voiding…" : "Confirm void"}
            </Button>
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

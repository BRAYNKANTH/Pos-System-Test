"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

// Shared approve/reject-with-PIN-reauth pattern for Modules 2 & 3's
// approval queues. Flow: password re-auth (grants a 5-minute elevated
// window server-side, see lib/auth/session.ts) → the actual
// approve/reject call.
export function ApprovalActions({
  approveUrl,
  rejectUrl,
  backHref,
}: {
  approveUrl: string;
  rejectUrl: string;
  backHref: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"approve" | "reject" | null>(null);
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function close() {
    setMode(null);
    setPassword("");
    setReason("");
    setError(null);
  }

  async function handleSubmit() {
    if (!password) {
      setError("Password is required");
      return;
    }
    if (mode === "reject" && !reason) {
      setError("A reason is required to reject");
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

      const url = mode === "approve" ? approveUrl : rejectUrl;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "reject" ? { reason } : {}),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Action failed");
        return;
      }
      close();
      router.push(backHref);
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex gap-2">
        <Button onClick={() => setMode("approve")}>Approve</Button>
        <Button variant="destructive" onClick={() => setMode("reject")}>
          Reject
        </Button>
      </div>

      <Modal open={mode !== null} onClose={close} title={mode === "approve" ? "Approve" : "Reject"}>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-zinc-500">Re-enter your password to confirm.</p>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="h-9 rounded-md border border-zinc-200 bg-transparent px-3 text-sm outline-none dark:border-zinc-800"
          />
          {mode === "reject" && (
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for rejection"
              className="h-20 rounded-md border border-zinc-200 bg-transparent px-3 py-2 text-sm outline-none dark:border-zinc-800"
            />
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Submitting…" : "Confirm"}
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

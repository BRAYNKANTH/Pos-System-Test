"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const DATA_CENTER_OPTIONS: { value: string; label: string }[] = [
  { value: "com", label: ".com — US / Global" },
  { value: "eu", label: ".eu — Europe" },
  { value: "in", label: ".in — India" },
  { value: "com.au", label: ".com.au — Australia" },
  { value: "jp", label: ".jp — Japan" },
];

const ERROR_MESSAGES: Record<string, string> = {
  missing_code: "Zoho didn't send back an authorization code — the connection attempt was cancelled or interrupted.",
  exchange_failed: "Zoho rejected the token exchange.",
};

export function IntegrationsClient({
  configured,
  connection,
  connected,
  error,
  detail,
}: {
  configured: boolean;
  connection: { organizationId: string; dataCenter: string; expiresAt: string } | null;
  connected: boolean;
  error?: string;
  detail?: string;
}) {
  const router = useRouter();
  const [dataCenter, setDataCenter] = useState(connection?.dataCenter || "com");
  const [orgId, setOrgId] = useState(connection?.organizationId ?? "");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  async function handleSaveOrgId(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await fetch("/api/admin/zoho", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId }),
      });
      const body = await res.json();
      if (body.success) {
        setSaveMsg("Saved.");
        router.refresh();
      } else {
        setSaveMsg(body.error?.message ?? "Failed to save");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {connected && <p className="text-sm text-green-600">Connected successfully.</p>}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
          <p className="font-semibold">{ERROR_MESSAGES[error] ?? "Connection failed."}</p>
          {detail && <p className="mt-1 font-mono opacity-80">{detail}</p>}
        </div>
      )}

      <div className="flex items-center justify-between rounded-md border border-zinc-200 p-4 text-sm dark:border-zinc-800">
        <div>
          <p className="font-medium">Zoho Books</p>
          <p className="text-xs text-zinc-400">
            {connection
              ? `Connected · data center .${connection.dataCenter} · token expires ${new Date(connection.expiresAt).toLocaleString()}`
              : "Not connected"}
          </p>
        </div>
        <Badge variant={connection ? "success" : "default"}>
          {connection ? "Connected" : "Disconnected"}
        </Badge>
      </div>

      {!configured && (
        <p className="text-xs text-amber-600">
          ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET aren&apos;t set in .env.local — get them from the{" "}
          <a
            href="https://api-console.zoho.com"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Zoho API Console
          </a>{" "}
          (Server-based Applications) before connecting.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
          Zoho data center — pick the one your Zoho account was created on
        </label>
        <select
          value={dataCenter}
          onChange={(e) => setDataCenter(e.target.value)}
          className="h-9 rounded-md border border-zinc-200 bg-transparent px-3 text-sm outline-none dark:border-zinc-800"
        >
          {DATA_CENTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {configured ? (
        <a href={`/api/sync/oauth/connect?dc=${dataCenter}`}>
          <Button>{connection ? "Reconnect" : "Connect"} to Zoho</Button>
        </a>
      ) : (
        <Button disabled>{connection ? "Reconnect" : "Connect"} to Zoho</Button>
      )}

      {connection && (
        <form onSubmit={handleSaveOrgId} className="flex flex-col gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
            Zoho Books Organization ID — find it in Zoho Books → Settings → Organization Profile
          </label>
          <div className="flex gap-2">
            <input
              required
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              placeholder="e.g. 60012345678"
              className="h-9 flex-1 rounded-md border border-zinc-200 bg-transparent px-3 text-sm outline-none dark:border-zinc-800"
            />
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
          {saveMsg && <p className="text-xs text-zinc-500">{saveMsg}</p>}
          {!connection.organizationId && (
            <p className="text-xs text-amber-600">
              Not set yet — every sync to Zoho will fail until this is filled in.
            </p>
          )}
        </form>
      )}
    </div>
  );
}

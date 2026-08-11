"use client";

import { useEffect, useState } from "react";

const BARCODE_TYPES = ["C128", "C39", "EAN13", "UPCA"];

export function BarcodeSettingsClient() {
  const [loading, setLoading] = useState(true);
  const [defaultType, setDefaultType] = useState("C128");
  const [prefix, setPrefix] = useState("");
  const [labelWidthMm, setLabelWidthMm] = useState("38");
  const [labelHeightMm, setLabelHeightMm] = useState("25");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/admin/barcode-settings")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setDefaultType(res.data.defaultType);
          setPrefix(res.data.prefix ?? "");
          setLabelWidthMm(String(res.data.labelWidthMm));
          setLabelHeightMm(String(res.data.labelHeightMm));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/barcode-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultType,
          prefix: prefix || undefined,
          labelWidthMm: Number(labelWidthMm),
          labelHeightMm: Number(labelHeightMm),
        }),
      });
      const body = await res.json();
      setMsg(body.success ? "Saved." : (body.error?.message ?? "Failed to save"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-zinc-400">Loading…</p>;

  return (
    <form onSubmit={handleSave} className="bg-white rounded-lg border border-zinc-200 shadow-sm p-6 max-w-lg space-y-4">
      <div>
        <label className="block text-xs font-bold text-zinc-650 mb-1.5 uppercase">Default Barcode Type</label>
        <select
          value={defaultType}
          onChange={(e) => setDefaultType(e.target.value)}
          className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
        >
          {BARCODE_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-bold text-zinc-650 mb-1.5 uppercase">SKU Prefix (optional)</label>
        <input
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
          placeholder="e.g. MS-"
          className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-zinc-650 mb-1.5 uppercase">Label Width (mm)</label>
          <input
            type="number"
            min="1"
            value={labelWidthMm}
            onChange={(e) => setLabelWidthMm(e.target.value)}
            className="h-9 w-full rounded border border-zinc-300 px-3 text-sm font-mono outline-none focus:border-indigo-500 bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-zinc-650 mb-1.5 uppercase">Label Height (mm)</label>
          <input
            type="number"
            min="1"
            value={labelHeightMm}
            onChange={(e) => setLabelHeightMm(e.target.value)}
            className="h-9 w-full rounded border border-zinc-300 px-3 text-sm font-mono outline-none focus:border-indigo-500 bg-white"
          />
        </div>
      </div>
      <div className="flex items-center gap-3 border-t pt-4">
        <button
          type="submit"
          disabled={saving}
          className="bg-indigo-650 hover:bg-indigo-750 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-sm transition disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
        {msg && <span className="text-xs text-zinc-500">{msg}</span>}
      </div>
    </form>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Edit, Trash2, X, Tag } from "lucide-react";

type Row = { name: string; productCount: number };

export function TaxonomyManager({
  label,
  apiPath,
}: {
  /** "Category" or "Brand" — used in headings/messages. */
  label: string;
  /** "/api/inventory/categories" or "/api/inventory/brands". */
  apiPath: string;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editingRow, setEditingRow] = useState<Row | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const res = await fetch(apiPath);
      const body = await res.json();
      if (body.success) {
        setRows(body.data);
      } else {
        setError(body.error?.message ?? "Failed to load");
      }
    } catch {
      // A network/DB hiccup shouldn't leave this stuck on "Loading…"
      // forever with no way forward.
      setError("Couldn't reach the server. Check your connection and retry.");
    } finally {
      setLoaded(true);
    }
  }

  // Fetch-on-mount effect — load() sets state synchronously (setError(""))
  // before its first await, which is what trips this rule; that's the
  // intended "clear any previous error, then fetch" sequencing, not a bug.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openRename(row: Row) {
    setEditingRow(row);
    setRenameValue(row.name);
    setError("");
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (!editingRow || !renameValue.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(apiPath, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: editingRow.name, to: renameValue.trim() }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Rename failed");
        return;
      }
      setEditingRow(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function handleClear(row: Row) {
    if (
      !confirm(
        `Remove "${row.name}" from ${row.productCount} product(s)? They'll become un${label.toLowerCase()}ed, not deleted.`,
      )
    )
      return;
    setBusy(true);
    try {
      const res = await fetch(`${apiPath}?name=${encodeURIComponent(row.name)}`, { method: "DELETE" });
      const body = await res.json();
      if (body.success) await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-zinc-150">
        <p className="text-xs text-zinc-450">
          {label} isn&apos;t a separate list you add to up front — it&apos;s whatever value products actually use. Rename here to fix a typo or merge duplicates across every product at once; clear to un-{label.toLowerCase()} them (products aren&apos;t deleted).
        </p>
      </div>

      {!loaded && <p className="p-6 text-center text-sm text-zinc-400">Loading…</p>}
      {loaded && error && (
        <div className="p-6 text-center space-y-2">
          <p className="text-sm text-red-600 font-semibold">{error}</p>
          <button
            onClick={load}
            className="text-xs font-bold text-indigo-650 hover:text-indigo-750 hover:underline"
          >
            Retry
          </button>
        </div>
      )}
      {loaded && !error && rows.length === 0 && (
        <p className="p-6 text-center text-sm text-zinc-400">No products have a {label.toLowerCase()} set yet.</p>
      )}
      {loaded && !error && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-50 text-zinc-650 font-bold border-b border-zinc-150 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">{label}</th>
                <th className="px-4 py-3 text-center">Products</th>
                <th className="px-4 py-3 w-32 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-sm">
              {rows.map((row) => (
                <tr key={row.name} className="hover:bg-zinc-50/50 transition">
                  <td className="px-4 py-3 font-bold text-zinc-800 flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5 text-indigo-400" /> {row.name}
                  </td>
                  <td className="px-4 py-3 text-center text-zinc-600">{row.productCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => openRename(row)}
                        disabled={busy}
                        className="border border-blue-200 text-blue-650 hover:bg-blue-50 px-2.5 py-1 rounded text-xs font-bold transition flex items-center gap-1 bg-white disabled:opacity-50"
                      >
                        <Edit className="h-3 w-3" /> Rename
                      </button>
                      <button
                        onClick={() => handleClear(row)}
                        disabled={busy}
                        className="border border-red-200 text-red-650 hover:bg-red-50 px-2.5 py-1 rounded text-xs font-bold transition flex items-center gap-1 bg-white disabled:opacity-50"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-lg border border-zinc-200 shadow-xl max-w-xs w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm text-zinc-800">Rename {label}</h3>
              <button onClick={() => setEditingRow(null)} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            <p className="text-xs text-zinc-500">
              Applies to all {editingRow.productCount} product(s) currently set to &quot;{editingRow.name}&quot;.
              {" "}If you rename to an existing {label.toLowerCase()}, they merge into one.
            </p>
            {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}
            <form onSubmit={handleRename} className="space-y-3">
              <input
                autoFocus
                required
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={busy}
                className="w-full py-2 bg-indigo-650 hover:bg-indigo-750 text-white rounded text-xs font-bold shadow-sm transition disabled:opacity-50"
              >
                {busy ? "Saving..." : "Save"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

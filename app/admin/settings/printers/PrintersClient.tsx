"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Edit, Trash2, X, Star } from "lucide-react";

type Printer = {
  id: string;
  name: string;
  connectionType: string;
  paperWidthMm: number;
  ipAddress: string | null;
  isDefault: boolean;
};

export function PrintersClient({ initialPrinters }: { initialPrinters: Printer[] }) {
  const router = useRouter();
  const [printers, setPrinters] = useState(initialPrinters);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Printer | null>(null);
  const [name, setName] = useState("");
  const [connectionType, setConnectionType] = useState("usb");
  const [paperWidthMm, setPaperWidthMm] = useState("80");
  const [ipAddress, setIpAddress] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function openAdd() {
    setEditing(null);
    setName("");
    setConnectionType("usb");
    setPaperWidthMm("80");
    setIpAddress("");
    setIsDefault(printers.length === 0);
    setError("");
    setFormOpen(true);
  }

  function openEdit(p: Printer) {
    setEditing(p);
    setName(p.name);
    setConnectionType(p.connectionType);
    setPaperWidthMm(String(p.paperWidthMm));
    setIpAddress(p.ipAddress ?? "");
    setIsDefault(p.isDefault);
    setError("");
    setFormOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(editing ? `/api/admin/printers/${editing.id}` : "/api/admin/printers", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          connectionType,
          paperWidthMm: Number(paperWidthMm),
          ipAddress: ipAddress || undefined,
          isDefault,
        }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Failed to save printer");
        return;
      }
      setFormOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(p: Printer) {
    if (!confirm(`Delete printer "${p.name}"?`)) return;
    const res = await fetch(`/api/admin/printers/${p.id}`, { method: "DELETE" });
    const body = await res.json();
    if (body.success) {
      setPrinters((prev) => prev.filter((x) => x.id !== p.id));
    } else {
      alert(body.error?.message ?? "Failed to delete printer");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={openAdd}
          className="bg-indigo-650 hover:bg-indigo-750 text-white px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="h-4 w-4" /> Add Printer
        </button>
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-lg border border-zinc-200 shadow-xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm text-zinc-800">{editing ? "Edit Printer" : "Add Printer"}</h3>
              <button onClick={() => setFormOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-650 mb-1">Name *</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. POS-80 Thermal Printer"
                  className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-650 mb-1">Connection</label>
                  <select
                    value={connectionType}
                    onChange={(e) => setConnectionType(e.target.value)}
                    className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500"
                  >
                    <option value="usb">USB</option>
                    <option value="network">Network</option>
                    <option value="bluetooth">Bluetooth</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-650 mb-1">Paper Width (mm)</label>
                  <input
                    type="number"
                    min="1"
                    value={paperWidthMm}
                    onChange={(e) => setPaperWidthMm(e.target.value)}
                    className="h-9 w-full rounded border border-zinc-300 px-3 text-sm font-mono outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              {connectionType === "network" && (
                <div>
                  <label className="block text-xs font-bold text-zinc-650 mb-1">IP Address</label>
                  <input
                    value={ipAddress}
                    onChange={(e) => setIpAddress(e.target.value)}
                    placeholder="192.168.1.50"
                    className="h-9 w-full rounded border border-zinc-300 px-3 text-sm font-mono outline-none focus:border-indigo-500"
                  />
                </div>
              )}
              <label className="flex items-center gap-2 text-xs font-semibold text-zinc-650">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="h-4 w-4 rounded text-indigo-600"
                />
                Default printer
              </label>
              <div className="flex justify-end gap-2 border-t pt-3">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-3.5 py-1.5 rounded border text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-indigo-650 hover:bg-indigo-750 text-white rounded text-xs font-bold shadow-sm transition disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-50 text-zinc-650 font-bold border-b border-zinc-150 uppercase tracking-wider text-xs">
              <tr>
                <th className="px-4 py-3.5">Printer Name</th>
                <th className="px-4 py-3.5">Connection</th>
                <th className="px-4 py-3.5">Paper Width</th>
                <th className="px-4 py-3.5 w-40 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-sm">
              {printers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-zinc-400">No printers configured yet.</td>
                </tr>
              )}
              {printers.map((printer) => (
                <tr key={printer.id} className="hover:bg-zinc-50/50 transition">
                  <td className="px-4 py-3.5 font-bold text-zinc-800 flex items-center gap-1.5">
                    {printer.name}
                    {printer.isDefault && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-650 text-[11px] font-bold uppercase">
                        <Star className="h-2.5 w-2.5 fill-current" /> Default
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-zinc-600 uppercase font-semibold">
                    {printer.connectionType}{printer.ipAddress ? ` · ${printer.ipAddress}` : ""}
                  </td>
                  <td className="px-4 py-3.5 font-mono text-zinc-600">{printer.paperWidthMm}mm</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => openEdit(printer)}
                        className="border border-blue-200 text-blue-650 hover:bg-blue-50 px-2.5 py-1 rounded text-xs font-bold transition flex items-center gap-1 bg-white"
                      >
                        <Edit className="h-3 w-3" /> Edit
                      </button>
                      <button
                        onClick={() => handleDelete(printer)}
                        className="border border-red-200 text-red-650 hover:bg-red-50 px-2.5 py-1 rounded text-xs font-bold transition flex items-center gap-1 bg-white"
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

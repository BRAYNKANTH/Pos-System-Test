"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Edit, Trash2, X } from "lucide-react";

type Location = {
  id: string;
  name: string;
  code: string;
  city: string | null;
  country: string | null;
  landmark: string | null;
  isDefault: boolean;
};

export function LocationsClient({
  initialLocations,
  canManage,
}: {
  initialLocations: Location[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [locations, setLocations] = useState(initialLocations);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [landmark, setLandmark] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function openAdd() {
    setEditing(null);
    setName("");
    setCode(`BL${String(locations.length + 1).padStart(4, "0")}`);
    setCity("");
    setCountry("");
    setLandmark("");
    setError("");
    setFormOpen(true);
  }

  function openEdit(l: Location) {
    setEditing(l);
    setName(l.name);
    setCode(l.code);
    setCity(l.city ?? "");
    setCountry(l.country ?? "");
    setLandmark(l.landmark ?? "");
    setError("");
    setFormOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(editing ? `/api/admin/locations/${editing.id}` : "/api/admin/locations", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          code: editing ? undefined : code,
          city: city || undefined,
          country: country || undefined,
          landmark: landmark || undefined,
        }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Failed to save location");
        return;
      }
      setFormOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(l: Location) {
    if (!confirm(`Delete location "${l.name}"?`)) return;
    const res = await fetch(`/api/admin/locations/${l.id}`, { method: "DELETE" });
    const body = await res.json();
    if (body.success) {
      setLocations((prev) => prev.filter((x) => x.id !== l.id));
    } else {
      alert(body.error?.message ?? "Failed to delete location");
    }
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <button
            onClick={openAdd}
            className="bg-indigo-650 hover:bg-indigo-750 text-white px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" /> Add Location
          </button>
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-lg border border-zinc-200 shadow-xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm text-zinc-800">{editing ? "Edit Location" : "Add Location"}</h3>
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
                  className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-650 mb-1">Location ID *</label>
                <input
                  required
                  disabled={!!editing}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="h-9 w-full rounded border border-zinc-300 px-3 text-sm font-mono outline-none focus:border-indigo-500 disabled:bg-zinc-50 disabled:text-zinc-400"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-650 mb-1">Landmark</label>
                <input
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-650 mb-1">City</label>
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-650 mb-1">Country</label>
                  <input
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
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
                <th className="px-4 py-3.5">Name</th>
                <th className="px-4 py-3.5">Location ID</th>
                <th className="px-4 py-3.5">Landmark</th>
                <th className="px-4 py-3.5">City</th>
                <th className="px-4 py-3.5">Country</th>
                {canManage && <th className="px-4 py-3.5 w-40 text-center">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-sm">
              {locations.map((loc) => (
                <tr key={loc.id} className="hover:bg-zinc-50/50 transition">
                  <td className="px-4 py-3.5 font-bold text-zinc-800">
                    {loc.name}
                    {loc.isDefault && (
                      <span className="ml-2 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-650 text-[11px] font-bold uppercase">
                        Default
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 font-mono text-zinc-550 font-semibold">{loc.code}</td>
                  <td className="px-4 py-3.5 text-zinc-600">{loc.landmark || "—"}</td>
                  <td className="px-4 py-3.5 text-zinc-600">{loc.city || "—"}</td>
                  <td className="px-4 py-3.5 text-zinc-600">{loc.country || "—"}</td>
                  {canManage && (
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openEdit(loc)}
                          className="border border-blue-200 text-blue-650 hover:bg-blue-50 px-2.5 py-1 rounded text-xs font-bold transition flex items-center gap-1 bg-white"
                        >
                          <Edit className="h-3 w-3" /> Edit
                        </button>
                        <button
                          onClick={() => handleDelete(loc)}
                          disabled={loc.isDefault}
                          className="border border-red-200 text-red-650 hover:bg-red-50 px-2.5 py-1 rounded text-xs font-bold transition flex items-center gap-1 bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="h-3 w-3" /> Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

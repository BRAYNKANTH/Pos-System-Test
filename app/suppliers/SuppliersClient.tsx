"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Edit, Trash2, X } from "lucide-react";

type Supplier = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  purchaseCount: number;
};

export function SuppliersClient({
  initialSuppliers,
  query,
  canManage,
}: {
  initialSuppliers: Supplier[];
  query: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function openAdd() {
    setEditing(null);
    setName("");
    setEmail("");
    setPhone("");
    setAddress("");
    setError("");
    setFormOpen(true);
  }

  function openEdit(s: Supplier) {
    setEditing(s);
    setName(s.name);
    setEmail(s.email ?? "");
    setPhone(s.phone ?? "");
    setAddress(s.address ?? "");
    setError("");
    setFormOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(editing ? `/api/suppliers/${editing.id}` : "/api/suppliers", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email: email || undefined,
          phone: phone || undefined,
          address: address || undefined,
        }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Failed to save supplier");
        return;
      }
      setFormOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(s: Supplier) {
    if (!confirm(`Delete supplier "${s.name}"?`)) return;
    const res = await fetch(`/api/suppliers/${s.id}`, { method: "DELETE" });
    const body = await res.json();
    if (body.success) {
      setSuppliers((prev) => prev.filter((x) => x.id !== s.id));
    } else {
      alert(body.error?.message ?? "Failed to delete supplier");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form className="flex gap-2">
          <input
            name="query"
            defaultValue={query}
            placeholder="Search by name, email, or phone…"
            className="h-9 w-64 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-indigo-500"
          />
        </form>
        {canManage && (
          <button
            onClick={openAdd}
            className="bg-indigo-650 hover:bg-indigo-750 text-white px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" /> Add Supplier
          </button>
        )}
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-lg border border-zinc-200 shadow-xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm text-zinc-800">{editing ? "Edit Supplier" : "Add Supplier"}</h3>
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
                <label className="block text-xs font-bold text-zinc-650 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-650 mb-1">Phone</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-650 mb-1">Address</label>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500"
                />
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
                <th className="px-4 py-3.5">Email</th>
                <th className="px-4 py-3.5">Phone</th>
                <th className="px-4 py-3.5">Address</th>
                <th className="px-4 py-3.5 text-center">Purchases</th>
                {canManage && <th className="px-4 py-3.5 w-40 text-center">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-sm">
              {suppliers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-400">No suppliers yet.</td>
                </tr>
              )}
              {suppliers.map((s) => (
                <tr key={s.id} className="hover:bg-zinc-50/50 transition">
                  <td className="px-4 py-3.5 font-bold text-zinc-800">{s.name}</td>
                  <td className="px-4 py-3.5 text-zinc-600">{s.email || "—"}</td>
                  <td className="px-4 py-3.5 text-zinc-600">{s.phone || "—"}</td>
                  <td className="px-4 py-3.5 text-zinc-600">{s.address || "—"}</td>
                  <td className="px-4 py-3.5 text-center font-mono font-semibold text-zinc-650">{s.purchaseCount}</td>
                  {canManage && (
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openEdit(s)}
                          className="border border-blue-200 text-blue-650 hover:bg-blue-50 px-2.5 py-1 rounded text-xs font-bold transition flex items-center gap-1 bg-white"
                        >
                          <Edit className="h-3 w-3" /> Edit
                        </button>
                        <button
                          onClick={() => handleDelete(s)}
                          className="border border-red-200 text-red-650 hover:bg-red-50 px-2.5 py-1 rounded text-xs font-bold transition flex items-center gap-1 bg-white"
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

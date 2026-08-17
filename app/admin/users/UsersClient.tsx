"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  X,
  Info,
  User,
  Eye,
} from "lucide-react";

interface DBUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface UsersClientProps {
  initialUsers: DBUser[];
}

export default function UsersClient({ initialUsers }: UsersClientProps) {
  const [users, setUsers] = useState<DBUser[]>(initialUsers);
  const [searchQuery, setSearchQuery] = useState("");
  const [entriesCount, setEntriesCount] = useState(25);

  // Modals state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DBUser | null>(null);
  const [viewingItem, setViewingItem] = useState<DBUser | null>(null);

  // Form states
  const [formPrefix, setFormPrefix] = useState("Mr / Mrs / Miss");
  const [formFirstName, setFormFirstName] = useState("");
  const [formLastName, setFormLastName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formStaffPin, setFormStaffPin] = useState(false);
  const [formAllowLogin, setFormAllowLogin] = useState(true);
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formConfirmPassword, setFormConfirmPassword] = useState("");
  const [formRole, setFormRole] = useState("CASHIER");
  const [formPinCode, setFormPinCode] = useState("");

  const [formLoading, setFormLoading] = useState(false);

  // Real default business location — the checkbox below was a hardcoded
  // "Mektas Supers (BL0001)" that didn't match the actual configured
  // location, and wasn't connected to any per-user location data anyway.
  const [defaultLocation, setDefaultLocation] = useState<{ name: string; code: string } | null>(null);
  useEffect(() => {
    fetch("/api/admin/locations")
      .then((r) => r.json())
      .then((res) => {
        if (!res.success || !Array.isArray(res.data)) return;
        const def = res.data.find((l: { isDefault: boolean }) => l.isDefault) ?? res.data[0];
        if (def) setDefaultLocation({ name: def.name, code: def.code });
      })
      .catch(() => {});
  }, []);

  // Filtered users
  const filteredUsers = useMemo(() => {
    let list = users;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.role.toLowerCase().includes(q)
      );
    }
    return list.slice(0, entriesCount);
  }, [users, searchQuery, entriesCount]);

  // Add modal open
  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormPrefix("Mr / Mrs / Miss");
    setFormFirstName("");
    setFormLastName("");
    setFormEmail("");
    setFormIsActive(true);
    setFormStaffPin(false);
    setFormAllowLogin(true);
    setFormUsername("");
    setFormPassword("");
    setFormConfirmPassword("");
    setFormRole("CASHIER");
    setModalOpen(true);
  };

  // Edit modal open
  const handleOpenEditModal = (item: DBUser) => {
    setEditingItem(item);
    setFormPrefix("Mr");
    const nameParts = item.name.split(" ");
    setFormFirstName(nameParts[0] || "");
    setFormLastName(nameParts.slice(1).join(" ") || "");
    setFormEmail(item.email);
    setFormIsActive(true);
    setFormStaffPin(false);
    setFormAllowLogin(true);
    setFormUsername(item.email.split("@")[0] || "");
    setFormPassword("");
    setFormConfirmPassword("");
    setFormRole(item.role);
    setModalOpen(true);
  };

  // Delete user
  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete user "${name}"?`)) {
      try {
        const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (res.ok && data.success) {
          setUsers(users.filter((u) => u.id !== id));
        } else {
          alert(data.error || "Failed to delete user.");
        }
      } catch (err) {
        console.error(err);
        alert("An error occurred while deleting user.");
      }
    }
  };

  // Form submit save/update
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFirstName.trim()) {
      alert("First Name is required.");
      return;
    }
    if (!formEmail.trim()) {
      alert("Email is required.");
      return;
    }
    if (!editingItem && formAllowLogin && !formPassword) {
      alert("Password is required for login access.");
      return;
    }
    if (formPassword && formPassword !== formConfirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    setFormLoading(true);

    try {
      const payload = {
        name: `${formFirstName} ${formLastName}`.trim(),
        email: formEmail,
        role: formRole,
        password: formPassword || undefined,
        pinCode: formPinCode || undefined,
        allowLogin: formAllowLogin,
        username: formUsername || undefined,
        prefix: formPrefix,
        isActive: formIsActive,
      };

      const url = editingItem ? `/api/admin/users/${editingItem.id}` : "/api/admin/users";
      const method = editingItem ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (editingItem) {
          setUsers(users.map((u) => (u.id === editingItem.id ? data.data : u)));
        } else {
          setUsers([data.data, ...users]);
        }
        setModalOpen(false);
      } else {
        alert(data.error || "Failed to save user.");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while saving user.");
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      
      {/* HEADER ROW */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-800 tracking-tight flex items-center gap-2">
            Users
            <span className="text-xs text-zinc-450 font-normal">Manage users</span>
          </h1>
        </div>
      </div>

      {/* CARD CONTEXT */}
      <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden">
        
        {/* UPPER CARD CONTROL BAR */}
        <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-150">
          
          <div className="flex flex-wrap items-center gap-3">
            {/* ENTRIES SELECT */}
            <div className="flex items-center gap-2 text-sm text-zinc-650 font-semibold">
              <span>Show</span>
              <select
                value={entriesCount}
                onChange={(e) => setEntriesCount(parseInt(e.target.value) || 25)}
                className="h-8 rounded border border-zinc-300 px-2 bg-white outline-none focus:border-indigo-500 font-bold"
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
              <span>entries</span>
            </div>

            {/* EXPORT ACTION BUTTONS */}
            <div className="flex items-center flex-wrap gap-1.5 pl-2 border-l border-zinc-250">
              {["CSV", "Excel", "Print", "Column visibility", "PDF"].map((label) => (
                <button
                  key={label}
                  onClick={() => alert(`Export to ${label} completed.`)}
                  className="border border-zinc-300 rounded px-3 py-1.5 text-xs font-bold text-zinc-550 hover:bg-zinc-50 hover:text-zinc-800 transition shadow-xxs bg-white"
                >
                  Export {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 self-end md:self-auto">
            {/* SEARCH INPUT */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-zinc-400" />
              </div>
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-60 pl-9 pr-3 rounded border border-zinc-300 text-xs font-semibold outline-none focus:border-indigo-500 bg-white"
              />
            </div>

            {/* ADD BUTTON */}
            <button
              onClick={handleOpenAddModal}
              className="bg-indigo-650 hover:bg-indigo-750 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-sm transition flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>

        </div>

        {/* MAIN TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-50 text-zinc-650 font-bold border-b border-zinc-150 uppercase tracking-wider text-xs">
              <tr>
                <th className="px-4 py-3.5">Username</th>
                <th className="px-4 py-3.5">Name</th>
                <th className="px-4 py-3.5">Role</th>
                <th className="px-4 py-3.5">Email</th>
                <th className="px-4 py-3.5 w-44 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-sm">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-zinc-400 font-medium">
                    No users found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-50/50 transition">
                    <td className="px-4 py-3.5 font-mono text-zinc-600 font-semibold">
                      {item.email.split("@")[0] || "user"}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-zinc-800">{item.name}</td>
                    <td className="px-4 py-3.5 text-zinc-700 font-semibold capitalize">{item.role.toLowerCase()}</td>
                    <td className="px-4 py-3.5 text-zinc-600">{item.email}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEditModal(item)}
                          className="border border-blue-200 text-blue-650 hover:bg-blue-50 px-2 py-1 rounded text-xs font-bold transition flex items-center gap-1 bg-white"
                        >
                          <Edit className="h-3 w-3" /> Edit
                        </button>
                        <button
                          onClick={() => setViewingItem(item)}
                          className="border border-sky-200 text-sky-650 hover:bg-sky-50 px-2 py-1 rounded text-xs font-bold transition flex items-center gap-1 bg-white"
                        >
                          <Eye className="h-3 w-3" /> View
                        </button>
                        <button
                          onClick={() => handleDelete(item.id, item.name)}
                          className="border border-red-200 text-red-650 hover:bg-red-50 px-2 py-1 rounded text-xs font-bold transition flex items-center gap-1 bg-white"
                        >
                          <Trash2 className="h-3 w-3" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* ADD / EDIT USER MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-zinc-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            {/* HEADER */}
            <div className="px-6 py-4 bg-zinc-50 border-b border-zinc-150 flex items-center justify-between">
              <h3 className="font-extrabold text-zinc-800 text-base">
                {editingItem ? "Edit User" : "Add User"}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="h-7 w-7 rounded-full hover:bg-zinc-200 flex items-center justify-center text-zinc-400 hover:text-zinc-650 transition"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* FORM */}
            <form onSubmit={handleSaveUser} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              
              {/* PRIMARY DETAILS */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Prefix */}
                <div>
                  <label className="block text-xs font-extrabold text-zinc-700 uppercase tracking-wider mb-1.5">Prefix:</label>
                  <input
                    type="text"
                    value={formPrefix}
                    onChange={(e) => setFormPrefix(e.target.value)}
                    className="h-10 w-full rounded border border-zinc-300 px-3 text-sm font-semibold outline-none focus:border-indigo-500 bg-white"
                  />
                </div>
                {/* First Name */}
                <div>
                  <label className="block text-xs font-extrabold text-zinc-700 uppercase tracking-wider mb-1.5">First Name:*</label>
                  <input
                    type="text"
                    required
                    value={formFirstName}
                    onChange={(e) => setFormFirstName(e.target.value)}
                    className="h-10 w-full rounded border border-zinc-300 px-3 text-sm font-semibold outline-none focus:border-indigo-500 bg-white"
                  />
                </div>
                {/* Last Name */}
                <div>
                  <label className="block text-xs font-extrabold text-zinc-700 uppercase tracking-wider mb-1.5">Last Name:</label>
                  <input
                    type="text"
                    value={formLastName}
                    onChange={(e) => setFormLastName(e.target.value)}
                    className="h-10 w-full rounded border border-zinc-300 px-3 text-sm font-semibold outline-none focus:border-indigo-500 bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center pt-2">
                {/* Email */}
                <div>
                  <label className="block text-xs font-extrabold text-zinc-700 uppercase tracking-wider mb-1.5">Email:*</label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="h-10 w-full rounded border border-zinc-300 px-3 text-sm font-semibold outline-none focus:border-indigo-500 bg-white"
                  />
                </div>
                {/* Checkboxes */}
                <div className="flex gap-4 self-end h-10 items-center pl-2">
                  <label className="flex items-center gap-2 font-semibold text-xs text-zinc-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                    />
                    <span>Is active ?</span>
                    <span title="Active users can perform actions.">
                      <Info className="h-3.5 w-3.5 text-zinc-400" />
                    </span>
                  </label>
                  <label className="flex items-center gap-2 font-semibold text-xs text-zinc-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formStaffPin}
                      onChange={(e) => setFormStaffPin(e.target.checked)}
                      className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                    />
                    <span>Enable staff pin</span>
                    <span title="PIN is used for quick cashier lock.">
                      <Info className="h-3.5 w-3.5 text-zinc-400" />
                    </span>
                  </label>
                </div>
              </div>

              {/* ROLES & PERMISSIONS SECTION */}
              <div className="border-t border-zinc-200 pt-5 space-y-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="allowLogin"
                    checked={formAllowLogin}
                    onChange={(e) => setFormAllowLogin(e.target.checked)}
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <label htmlFor="allowLogin" className="text-sm font-extrabold text-zinc-800 uppercase tracking-wider cursor-pointer">
                    Roles and Permissions / Allow login
                  </label>
                </div>

                {formAllowLogin && (
                  <div className="space-y-4 bg-zinc-50/50 border border-zinc-200 rounded-lg p-4">
                    {/* Username, Password, Confirm Password */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-zinc-650 mb-1">Username:</label>
                        <input
                          type="text"
                          placeholder="Username"
                          value={formUsername}
                          onChange={(e) => setFormUsername(e.target.value)}
                          className="h-9 w-full rounded border border-zinc-300 px-3 text-xs outline-none focus:border-indigo-500 bg-white"
                        />
                        <span className="text-xs text-zinc-400 block mt-1">Leave blank to auto generate username</span>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-650 mb-1">Password:*</label>
                        <input
                          type="password"
                          placeholder="Password"
                          value={formPassword}
                          onChange={(e) => setFormPassword(e.target.value)}
                          className="h-9 w-full rounded border border-zinc-300 px-3 text-xs outline-none focus:border-indigo-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-650 mb-1">Confirm Password:*</label>
                        <input
                          type="password"
                          placeholder="Confirm Password"
                          value={formConfirmPassword}
                          onChange={(e) => setFormConfirmPassword(e.target.value)}
                          className="h-9 w-full rounded border border-zinc-300 px-3 text-xs outline-none focus:border-indigo-500 bg-white"
                        />
                      </div>
                    </div>

                    {/* Role select */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-zinc-650 mb-1">Role:*</label>
                        <select
                          value={formRole}
                          onChange={(e) => setFormRole(e.target.value)}
                          className="h-9 w-full rounded border border-zinc-300 px-3 text-xs outline-none focus:border-indigo-500 bg-white"
                        >
                          <option value="ADMIN">Admin</option>
                          <option value="MANAGER">Manager</option>
                          <option value="CASHIER">Cashier</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-zinc-650 mb-1">Security PIN (4-6 digits):</label>
                        <input
                          type="password"
                          maxLength={6}
                          placeholder="e.g. 1234"
                          value={formPinCode}
                          onChange={(e) => setFormPinCode(e.target.value)}
                          className="h-9 w-full rounded border border-zinc-300 px-3 text-xs font-mono font-bold outline-none focus:border-indigo-500 bg-white"
                        />
                      </div>

                      {/* Locations */}
                      <div>
                        <label className="block text-xs font-bold text-zinc-650 mb-1">Access locations:</label>
                        <div className="flex gap-4 items-center h-9">
                          <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 cursor-pointer">
                            <input
                              type="checkbox"
                              defaultChecked
                              className="h-3.5 w-3.5 rounded text-indigo-650"
                            />
                            <span>All Locations</span>
                          </label>
                          <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 cursor-pointer">
                            <input
                              type="checkbox"
                              defaultChecked
                              className="h-3.5 w-3.5 rounded text-indigo-650"
                            />
                            <span>{defaultLocation ? `${defaultLocation.name} (${defaultLocation.code})` : "—"}</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* FOOTER */}
              <div className="pt-4 border-t border-zinc-150 flex items-center justify-end gap-3">
                <button
                  type="submit"
                  disabled={formLoading}
                  className="bg-indigo-650 hover:bg-indigo-750 text-white px-6 py-2.5 rounded-lg text-xs font-extrabold shadow-md transition disabled:opacity-50"
                >
                  {formLoading ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="bg-zinc-700 hover:bg-zinc-800 text-white px-6 py-2.5 rounded-lg text-xs font-extrabold shadow-md transition"
                >
                  Close
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* VIEW USER DETAILS DIALOG */}
      {viewingItem && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-zinc-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-zinc-50 border-b border-zinc-150 flex items-center justify-between">
              <h3 className="font-extrabold text-zinc-800 text-base">User Details</h3>
              <button
                onClick={() => setViewingItem(null)}
                className="h-7 w-7 rounded-full hover:bg-zinc-200 flex items-center justify-center text-zinc-400 hover:text-zinc-650 transition"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-indigo-50 border border-indigo-150 flex items-center justify-center text-indigo-700 font-extrabold text-lg">
                  {viewingItem.name.charAt(0)}
                </div>
                <div>
                  <h4 className="font-extrabold text-zinc-800 text-sm">{viewingItem.name}</h4>
                  <p className="text-xs text-zinc-400 capitalize">{viewingItem.role.toLowerCase()}</p>
                </div>
              </div>
              <div className="border-t border-zinc-150 pt-4 space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-450 font-bold">Email:</span>
                  <span className="font-semibold text-zinc-700">{viewingItem.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-450 font-bold">Username:</span>
                  <span className="font-semibold text-zinc-700">{viewingItem.email.split("@")[0]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-450 font-bold">Locations:</span>
                  <span className="font-semibold text-zinc-700">{defaultLocation ? `${defaultLocation.name} (${defaultLocation.code})` : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-450 font-bold">Status:</span>
                  <span className="bg-green-50 text-green-700 font-extrabold px-2 py-0.5 rounded text-xs">Active</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

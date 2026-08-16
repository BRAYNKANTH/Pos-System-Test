"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  ChevronLeft,
  CheckSquare,
  Square,
  Lock,
} from "lucide-react";

interface Grant {
  role: string;
  permissionKey: string;
}

interface RolesClientProps {
  initialGrants: Grant[];
}

const ROLES = ["ADMIN", "MANAGER", "CASHIER"] as const;

// Categorized permission mappings
const PERMISSION_GROUPS = [
  {
    category: "Others",
    permissions: [
      { key: "export:tables", label: "View export to buttons (csv/excel/print/pdf) on tables" },
    ],
  },
  {
    category: "User",
    permissions: [
      { key: "user:view", label: "View user" },
      { key: "user:create", label: "Add user" },
      { key: "user:update", label: "Edit user" },
      { key: "user:delete", label: "Delete user" },
    ],
  },
  {
    category: "Roles",
    permissions: [
      { key: "role:view", label: "View role" },
      { key: "role:create", label: "Add Role" },
      { key: "role:update", label: "Edit Role" },
      { key: "role:delete", label: "Delete role" },
    ],
  },
  {
    category: "Supplier",
    permissions: [
      { key: "supplier:view", label: "View all supplier" },
      { key: "supplier:view-own", label: "View own supplier" },
      { key: "supplier:create", label: "Add supplier" },
      { key: "supplier:update", label: "Edit supplier" },
      { key: "supplier:delete", label: "Delete supplier" },
    ],
  },
  {
    category: "Customer",
    permissions: [
      { key: "customer:view", label: "View all customer" },
      { key: "customer:view-own", label: "View own customer" },
      { key: "customer:no-sell-1m", label: "View customers with no sell from one month only" },
      { key: "customer:no-sell-3m", label: "View customers with no sell from three months only" },
      { key: "customer:no-sell-6m", label: "View customers with no sell from six months only" },
    ],
  },
  {
    category: "Core POS & Bills",
    permissions: [
      { key: "bills:approve", label: "Approve Bills" },
      { key: "bills:reject", label: "Reject Bills" },
      { key: "bills:request-change", label: "Request Bill Change" },
      { key: "inventory:approve", label: "Approve Inventory Adjustments" },
      { key: "inventory:reject", label: "Reject Inventory Adjustments" },
      { key: "inventory:adjust", label: "Request Inventory Adjustment" },
      { key: "admin:manage-thresholds", label: "Manage Approval Thresholds" },
      { key: "admin:manage-roles", label: "Manage Roles & Permissions" },
      { key: "admin:reauth", label: "Admin PIN Re-authentication" },
      { key: "reports:view", label: "View Reports" },
      { key: "reports:audit-view", label: "View Audit Trail Logs" },
    ],
  },
];

export default function RolesClient({ initialGrants }: RolesClientProps) {
  const [grants, setGrants] = useState<Set<string>>(
    new Set(initialGrants.map((g) => `${g.role}:${g.permissionKey}`))
  );

  // Views state: 'list' | 'edit'
  const [viewMode, setViewMode] = useState<"list" | "edit">("list");
  const [activeRole, setActiveRole] = useState<string>("CASHIER");
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);

  // Form selected keys for active editing role
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // Filter roles for list
  const filteredRoles = useMemo(() => {
    return ROLES.filter((r: string) => r.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [searchQuery]);

  // Open editor
  const handleEditRole = (role: string) => {
    setActiveRole(role);
    // Extract keys for this role
    const keys = new Set<string>();
    PERMISSION_GROUPS.forEach((gp) => {
      gp.permissions.forEach((p) => {
        if (grants.has(`${role}:${p.key}`)) {
          keys.add(p.key);
        }
      });
    });
    setSelectedKeys(keys);
    setViewMode("edit");
  };

  // Toggle permission key
  const handleToggleKey = (key: string) => {
    const next = new Set(selectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedKeys(next);
  };

  // Category select all
  const handleToggleGroup = (category: string, permissions: { key: string }[]) => {
    const allChecked = permissions.every((p) => selectedKeys.has(p.key));
    const next = new Set(selectedKeys);
    if (allChecked) {
      permissions.forEach((p) => next.delete(p.key));
    } else {
      permissions.forEach((p) => next.add(p.key));
    }
    setSelectedKeys(next);
  };

  // Save changes via API
  const handleSavePermissions = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const allKeys = PERMISSION_GROUPS.flatMap((gp) => gp.permissions.map((p) => p.key));
      const nextGrants = new Set(grants);

      // Perform parallel API requests
      const promises: Promise<void>[] = [];

      for (const key of allKeys) {
        const currentlyGranted = grants.has(`${activeRole}:${key}`);
        const wantGranted = selectedKeys.has(key);

        if (wantGranted && !currentlyGranted) {
          // Grant it
          promises.push(
            fetch("/api/admin/roles", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ role: activeRole, permissionKey: key }),
            }).then(async (res) => {
              if (res.ok) {
                nextGrants.add(`${activeRole}:${key}`);
              } else {
                throw new Error(`Failed to grant permission: ${key}`);
              }
            })
          );
        } else if (!wantGranted && currentlyGranted) {
          // Revoke it
          promises.push(
            fetch("/api/admin/roles", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ role: activeRole, permissionKey: key }),
            }).then(async (res) => {
              if (res.ok) {
                nextGrants.delete(`${activeRole}:${key}`);
              } else {
                throw new Error(`Failed to revoke permission: ${key}`);
              }
            })
          );
        }
      }

      await Promise.all(promises);
      setGrants(nextGrants);
      setViewMode("list");
    } catch (err) {
      console.error(err);
      alert("Failed to save role permissions.");
    } finally {
      setSaving(false);
    }
  };

  if (viewMode === "edit") {
    return (
      <div className="p-6 space-y-6">
        
        {/* HEADER */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setViewMode("list")}
            className="h-9 w-9 rounded-full hover:bg-zinc-200 flex items-center justify-center text-zinc-650 transition"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-zinc-800 tracking-tight flex items-center gap-1.5">
              Edit Role
              <span className="bg-indigo-50 text-indigo-700 text-xs px-2.5 py-0.5 rounded font-bold capitalize">
                {activeRole.toLowerCase()}
              </span>
            </h1>
          </div>
        </div>

        {/* PERMISSIONS GRID FORM */}
        <form onSubmit={handleSavePermissions} className="bg-white rounded-lg border border-zinc-200 p-6 shadow-sm space-y-6">
          
          <div>
            <label className="block text-xs font-extrabold text-zinc-700 uppercase tracking-wider mb-2">Role Name:*</label>
            <input
              type="text"
              readOnly
              value={activeRole}
              className="h-10 w-full sm:w-80 rounded border border-zinc-300 px-3 text-sm font-semibold outline-none bg-zinc-55 text-zinc-450 border-zinc-200 select-none bg-zinc-50"
            />
          </div>

          <div className="border-t border-zinc-150 pt-5 space-y-6">
            <h3 className="font-extrabold text-sm text-zinc-800 uppercase tracking-wide">Permissions:</h3>
            
            {PERMISSION_GROUPS.map((gp) => {
              const allChecked = gp.permissions.every((p) => selectedKeys.has(p.key));
              return (
                <div key={gp.category} className="border border-zinc-200 rounded-lg p-5 bg-zinc-50/50 space-y-3.5 shadow-xxs">
                  
                  {/* Category Header with Select All */}
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="font-extrabold text-xs text-zinc-700 uppercase tracking-wide">{gp.category}</span>
                    <button
                      type="button"
                      onClick={() => handleToggleGroup(gp.category, gp.permissions)}
                      className="flex items-center gap-1 text-xs font-bold text-indigo-650 hover:underline"
                    >
                      {allChecked ? "Deselect all" : "Select all"}
                    </button>
                  </div>

                  {/* Checkboxes List */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {gp.permissions.map((p) => (
                      <label
                        key={p.key}
                        className="flex items-start gap-2.5 text-xs text-zinc-650 font-semibold cursor-pointer select-none hover:text-zinc-950 transition"
                      >
                        <input
                          type="checkbox"
                          checked={selectedKeys.has(p.key)}
                          onChange={() => handleToggleKey(p.key)}
                          className="h-4 w-4 rounded text-indigo-650 mt-0.5"
                        />
                        <span>{p.label}</span>
                      </label>
                    ))}
                  </div>

                </div>
              );
            })}
          </div>

          {/* FORM FOOTER */}
          <div className="border-t border-zinc-150 pt-5 flex items-center justify-end gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-indigo-650 hover:bg-indigo-750 text-white px-6 py-2.5 rounded-lg text-xs font-extrabold shadow-md transition disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className="bg-zinc-700 hover:bg-zinc-800 text-white px-6 py-2.5 rounded-lg text-xs font-extrabold shadow-md transition"
            >
              Close
            </button>
          </div>

        </form>

      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      
      {/* HEADER ROW */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-800 tracking-tight flex items-center gap-2">
            Roles
            <span className="text-xs text-zinc-450 font-normal">Manage roles</span>
          </h1>
        </div>
      </div>

      {/* CARD CONTEXT */}
      <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden">
        
        {/* UPPER CARD CONTROL BAR */}
        <div className="p-5 flex items-center justify-end gap-4 border-b border-zinc-150">

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
          </div>

        </div>

        {/* ROLES TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-50 text-zinc-650 font-bold border-b border-zinc-150 uppercase tracking-wider text-xs">
              <tr>
                <th className="px-4 py-3.5">Roles</th>
                <th className="px-4 py-3.5 w-44 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-sm">
              {filteredRoles.map((role: string) => (
                <tr key={role} className="hover:bg-zinc-50/50 transition">
                  <td className="px-4 py-3.5 font-bold text-zinc-800">{role}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => handleEditRole(role)}
                        className="border border-blue-200 text-blue-650 hover:bg-blue-50 px-2.5 py-1 rounded text-xs font-bold transition flex items-center gap-1 bg-white"
                      >
                        <Edit className="h-3 w-3" /> Edit
                      </button>
                      <button
                        disabled
                        className="border border-zinc-200 text-zinc-400 px-2.5 py-1 rounded text-xs font-bold transition flex items-center gap-1 bg-zinc-50 cursor-not-allowed"
                        title="Core system roles cannot be deleted."
                      >
                        <Lock className="h-3 w-3" /> Delete
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

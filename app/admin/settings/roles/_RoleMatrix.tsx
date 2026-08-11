"use client";

import { useState } from "react";
import { PERMISSIONS } from "@/lib/auth/rbac";

const ROLES = ["ADMIN", "MANAGER", "CASHIER"] as const;

export function RoleMatrix({
  initialGrants,
}: {
  initialGrants: { role: string; permissionKey: string }[];
}) {
  const [grants, setGrants] = useState(
    new Set(initialGrants.map((g) => `${g.role}:${g.permissionKey}`)),
  );
  const [pending, setPending] = useState<string | null>(null);

  async function toggle(role: string, permissionKey: string) {
    const key = `${role}:${permissionKey}`;
    const currentlyGranted = grants.has(key);
    setPending(key);
    try {
      await fetch("/api/admin/roles", {
        method: currentlyGranted ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, permissionKey }),
      });
      setGrants((prev) => {
        const next = new Set(prev);
        if (currentlyGranted) next.delete(key);
        else next.add(key);
        return next;
      });
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-xs text-zinc-500 dark:bg-zinc-900">
          <tr>
            <th className="px-4 py-2 font-medium">Permission</th>
            {ROLES.map((r) => (
              <th key={r} className="px-4 py-2 text-center font-medium">
                {r}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {Object.values(PERMISSIONS).map((permissionKey) => (
            <tr key={permissionKey}>
              <td className="px-4 py-2 font-mono text-xs">{permissionKey}</td>
              {ROLES.map((role) => {
                const key = `${role}:${permissionKey}`;
                return (
                  <td key={role} className="px-4 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={grants.has(key)}
                      disabled={pending === key}
                      onChange={() => toggle(role, permissionKey)}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

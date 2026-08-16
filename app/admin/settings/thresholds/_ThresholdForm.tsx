"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ThresholdForm({
  initialType,
  initialValue,
}: {
  initialType: string;
  initialValue: number;
}) {
  const router = useRouter();
  const [type, setType] = useState(initialType);
  const [value, setValue] = useState(String(initialValue));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/thresholds", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "default", thresholdType: type, value: Number(value) }),
      });
      const body = await res.json();
      if (body.success) {
        setMessage("Saved.");
        router.refresh();
      } else {
        setMessage(body.error?.message ?? "Failed to save");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Threshold type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="h-9 rounded-md border border-zinc-200 bg-transparent px-3 text-sm dark:border-zinc-800"
        >
          <option value="absolute">Absolute quantity</option>
          <option value="percent">Percent of current stock</option>
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Value</label>
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-9 rounded-md border border-zinc-200 bg-transparent px-3 text-sm outline-none focus:border-indigo-500 dark:border-zinc-800"
        />
      </div>
      {message && <p className="text-sm text-zinc-500">{message}</p>}
      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}

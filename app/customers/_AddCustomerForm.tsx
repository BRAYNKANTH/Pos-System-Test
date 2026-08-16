"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function AddCustomerForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email: email || undefined, phone: phone || undefined }),
      });
      const body = await res.json();
      if (body.success) {
        setName("");
        setEmail("");
        setPhone("");
        setOpen(false);
        router.refresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        + Add customer
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
      <input
        required
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-9 rounded-md border border-zinc-200 bg-transparent px-3 text-sm outline-none focus:border-indigo-500 dark:border-zinc-800"
      />
      <input
        placeholder="Email (optional)"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="h-9 rounded-md border border-zinc-200 bg-transparent px-3 text-sm outline-none focus:border-indigo-500 dark:border-zinc-800"
      />
      <input
        placeholder="Phone (optional)"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="h-9 rounded-md border border-zinc-200 bg-transparent px-3 text-sm outline-none focus:border-indigo-500 dark:border-zinc-800"
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={submitting || !name}>
          {submitting ? "Saving..." : "Save"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

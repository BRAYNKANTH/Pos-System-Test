"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function NewOrderButton({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  async function handleClick() {
    setCreating(true);
    try {
      await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId }),
      });
      router.refresh();
    } finally {
      setCreating(false);
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={handleClick} disabled={creating}>
      {creating ? "Creating…" : "+ New order"}
    </Button>
  );
}

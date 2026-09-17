"use client";

import { useRouter } from "next/navigation";
import { useCartStore } from "@/lib/pos/cart-store";

export function LogoutButton() {
  const router = useRouter();
  async function handleLogout() {
    if (useCartStore.getState().lines.length && !window.confirm("Log out? Your active cart is saved on this tab for your next login.")) return;
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (!response.ok) return;
    router.push("/login");
    router.refresh();
  }
  return (
    <button onClick={handleLogout} className="font-semibold text-zinc-700 dark:text-zinc-300 hover:underline">
      Log out
    </button>
  );
}

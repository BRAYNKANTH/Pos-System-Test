"use client";

import { useEffect } from "react";
import { useCartStore } from "@/lib/pos/cart-store";

/** Per-user, per-tab recovery; never hydrate another cashier's cart. */
export function CartRecovery({ userId }: { userId: string }) {
  useEffect(() => {
    const key = `pos-cart:${userId}`;
    useCartStore.getState().clear();
    try {
      sessionStorage.setItem("pos-user", userId);
      const raw = sessionStorage.getItem(key);
      if (raw && useCartStore.getState().lines.length === 0) {
        const saved = JSON.parse(raw);
        if (saved.version === 1 && Array.isArray(saved.lines)) {
          useCartStore.getState().loadHeldCart(saved);
          if (saved.loyaltyRedeem && saved.customerId) {
            useCartStore.getState().applyLoyaltyRedeem(saved.loyaltyRedeem.points, saved.loyaltyRedeem.value);
          }
        }
      }
    } catch { /* A damaged or unavailable browser cache must not prevent checkout. */ }
    return useCartStore.subscribe((s) => {
      try {
        sessionStorage.setItem(key, JSON.stringify({ version: 1, id: s.heldCartId, lines: s.lines,
          discount: s.discount, loyaltyRedeem: s.loyaltyRedeem, shipping: s.shipping,
          customerId: s.customerId, customerName: s.customerName }));
      } catch { window.dispatchEvent(new CustomEvent("pos-recovery-error")); }
    });
  }, [userId]);
  return null;
}

"use client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCartStore } from "./cart-store";
import type { CartCalculation } from "./pricing";

export function useSaleQuote() {
  const { lines, discount, loyaltyRedeem, shipping, customerId } = useCartStore();
  const payload = JSON.stringify({ items: lines.map(l => ({ sku: l.sku, qty: l.qty, scaleWeight: l.scaleWeight,
    batchNumber: l.batchNumber, serialNumbers: l.serialNumbers, priceOverride: l.priceOverride ?? undefined, lineDiscount: l.lineDiscount ?? undefined })),
    discount: !loyaltyRedeem && discount ? { ...discount, scope: "cart" } : undefined,
    redeemLoyaltyPoints: loyaltyRedeem?.points, shipping, customerId });
  const [settled, setSettled] = useState(payload);
  useEffect(() => { const timer = setTimeout(() => setSettled(payload), 180); return () => clearTimeout(timer); }, [payload]);
  const quote = useQuery({ queryKey: ["sale-quote", settled], enabled: lines.length > 0 && settled === payload, retry: false,
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/pos/cart/calculate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: settled, signal });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error?.message ?? 'Could not confirm current prices. Retry before payment.');
      return body.data as CartCalculation;
    } });
  return { ...quote, ready: settled === payload && quote.isSuccess && !quote.isFetching, pending: settled !== payload || quote.isFetching };
}

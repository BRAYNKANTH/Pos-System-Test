"use client";

import { create } from "zustand";

export type LinePriceOverride = { newPrice: number; reason: string };
export type LineDiscount = { type: "percent" | "amount"; value: number };

export type CartLine = {
  sku: string;
  name: string;
  unitPrice: number;
  qty: number;
  /** Manager-discretion price override for this line only (damaged item,
   * price match, etc) — checkout audit-logs it, gated by PRICE_OVERRIDE. */
  priceOverride?: LinePriceOverride | null;
  /** Per-line discount, distinct from the cart-wide `discount` below —
   * stacks additively with any auto-applied scheduled Discount. */
  lineDiscount?: LineDiscount | null;
  description?: string | null;
  lotExpiry?: string | null;
  unit?: string | null;
};

export type CartDiscount = { type: "percent" | "amount"; value: number } | null;

/** Tracks that the current `discount` came from redeeming the linked
 * customer's loyalty points (as opposed to a manual/scheduled discount) —
 * checkout needs the point count separately from the Rs value so it can
 * actually deduct the points server-side (see applyLoyaltyRedeem's docs). */
export type LoyaltyRedeem = { points: number; value: number } | null;

type CartState = {
  lines: CartLine[];
  discount: CartDiscount;
  loyaltyRedeem: LoyaltyRedeem;
  shipping: number;
  customerId: string | null;
  customerName: string | null;
  heldCartId: string | null;
  addItem: (item: { sku: string; name: string; unitPrice: number }) => void;
  removeItem: (sku: string) => void;
  setQty: (sku: string, qty: number) => void;
  setLinePriceOverride: (sku: string, override: LinePriceOverride | null) => void;
  setLineDiscount: (sku: string, discount: LineDiscount | null) => void;
  setLineDescription: (sku: string, description: string | null) => void;
  setLineLotExpiry: (sku: string, lotExpiry: string | null) => void;
  setLineUnit: (sku: string, unit: string | null) => void;
  setDiscount: (discount: CartDiscount) => void;
  /** Apply a cart discount funded by spending the customer's loyalty
   * points. Distinct from setDiscount so checkout can tell "redeem N
   * points" apart from an arbitrary manual/promo discount of the same Rs
   * value — the server is the one that actually deducts the points, this
   * only stages the intent + the discount preview. */
  applyLoyaltyRedeem: (points: number, value: number) => void;
  clearLoyaltyRedeem: () => void;
  setShipping: (shipping: number) => void;
  setCustomer: (customer: { id: string; name: string } | null) => void;
  setHeldCartId: (id: string | null) => void;
  /** Reloads a held cart's contents (see /api/pos/hold/:id resume). */
  loadHeldCart: (data: {
    id: string;
    lines: CartLine[];
    discount: CartDiscount;
    shipping: number;
    customerId: string | null;
    customerName: string | null;
  }) => void;
  /** Loads a converted Quotation's items into the cart — deliberately
   * doesn't touch heldCartId (unlike loadHeldCart), since a quotation
   * isn't a HeldCart row and nothing should try to DELETE it on resume. */
  loadQuotationItems: (data: {
    lines: CartLine[];
    customerId: string | null;
    customerName: string | null;
  }) => void;
  clear: () => void;
};

// Plain in-memory Zustand store — survives client-side navigation between
// /pos and /pos/payment (Next.js App Router doesn't full-reload for
// internal links), but not a hard page refresh. Good enough for a single
// checkout flow; not persisted to storage (park a cart server-side via
// Suspend/Draft — lib/pos — instead of relying on this surviving a reload).
export const useCartStore = create<CartState>((set) => ({
  lines: [],
  discount: null,
  loyaltyRedeem: null,
  shipping: 0,
  customerId: null,
  customerName: null,
  heldCartId: null,
  // Any direct discount edit (including clearing it) invalidates a prior
  // loyalty redemption tag — otherwise a cashier could apply the loyalty
  // discount, then edit the Rs/percent value inline, and checkout would
  // still try to redeem the original point count against a now-mismatched
  // discount amount.
  setDiscount: (discount) => set({ discount, loyaltyRedeem: null }),
  applyLoyaltyRedeem: (points, value) =>
    set({ discount: { type: "amount", value }, loyaltyRedeem: { points, value } }),
  clearLoyaltyRedeem: () => set({ discount: null, loyaltyRedeem: null }),
  setShipping: (shipping) => set({ shipping }),
  setCustomer: (customer) =>
    set({ customerId: customer?.id ?? null, customerName: customer?.name ?? null }),
  setHeldCartId: (heldCartId) => set({ heldCartId }),
  loadHeldCart: (data) =>
    set({
      heldCartId: data.id,
      lines: data.lines,
      discount: data.discount,
      // Held carts don't persist which discount was a loyalty redemption —
      // treat a resumed discount as a plain one rather than assuming it
      // still maps to the same point count on the (possibly now-different)
      // customer.
      loyaltyRedeem: null,
      shipping: data.shipping,
      customerId: data.customerId,
      customerName: data.customerName,
    }),
  loadQuotationItems: (data) =>
    set({
      lines: data.lines,
      customerId: data.customerId,
      customerName: data.customerName,
      discount: null,
      loyaltyRedeem: null,
      shipping: 0,
    }),
  addItem: (item) =>
    set((state) => {
      const existing = state.lines.find((l) => l.sku === item.sku);
      if (existing) {
        return {
          lines: state.lines.map((l) => (l.sku === item.sku ? { ...l, qty: l.qty + 1 } : l)),
        };
      }
      return { lines: [...state.lines, { ...item, qty: 1 }] };
    }),
  removeItem: (sku) => set((state) => ({ lines: state.lines.filter((l) => l.sku !== sku) })),
  setQty: (sku, qty) =>
    set((state) => ({
      lines:
        qty <= 0
          ? state.lines.filter((l) => l.sku !== sku)
          : state.lines.map((l) => (l.sku === sku ? { ...l, qty } : l)),
    })),
  setLinePriceOverride: (sku, override) =>
    set((state) => ({
      lines: state.lines.map((l) => (l.sku === sku ? { ...l, priceOverride: override } : l)),
    })),
  setLineDiscount: (sku, discount) =>
    set((state) => ({
      lines: state.lines.map((l) => (l.sku === sku ? { ...l, lineDiscount: discount } : l)),
    })),
  setLineDescription: (sku, description) =>
    set((state) => ({
      lines: state.lines.map((l) => (l.sku === sku ? { ...l, description } : l)),
    })),
  setLineLotExpiry: (sku, lotExpiry) =>
    set((state) => ({
      lines: state.lines.map((l) => (l.sku === sku ? { ...l, lotExpiry } : l)),
    })),
  setLineUnit: (sku, unit) =>
    set((state) => ({
      lines: state.lines.map((l) => (l.sku === sku ? { ...l, unit } : l)),
    })),
  clear: () =>
    set({ lines: [], discount: null, loyaltyRedeem: null, shipping: 0, customerId: null, customerName: null, heldCartId: null }),
}));

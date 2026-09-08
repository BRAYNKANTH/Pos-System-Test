"use client";

import { create } from "zustand";

export type LinePriceOverride = { newPrice: number; reason: string };
export type LineDiscount = { type: "percent" | "amount"; value: number };

export type CartLine = {
  /** Unique per cart line — NOT the same as `sku`. Two lines can share a
   * SKU (two separately-weighed bags of the same loose item, two
   * serialized units of the same model), and every per-line action below
   * (remove, qty, price override, batch, serials, ...) addresses a line
   * by this `id`, never by `sku` — keying by sku would apply the action
   * to every line sharing that SKU at once. */
  id: string;
  sku: string;
  name: string;
  unitPrice: number;
  qty: number;
  purchasePrice?: number;
  scaleWeight?: number;
  /** Catalog per-kg rate, for display only ("0.450 kg @ Rs 200.00/kg") —
   * `unitPrice` above is already the resolved charge for this line (see
   * lib/pos/scale-barcode.ts's docs on why). */
  displayRatePerKg?: number;
  isScaleItem?: boolean;
  isReturnable?: boolean;
  trackSerial?: boolean;
  trackBatch?: boolean;
  batchNumber?: string;
  serialNumbers?: string[];
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

/** A line from a source that never had (or may not have) per-line
 * identity — a held cart's stored JSON, or a quotation's items. */
type CartLineMaybeWithId = Omit<CartLine, "id"> & { id?: string };

/** Assigns a fresh line id to any line that doesn't already have one. */
function withLineIds(lines: CartLineMaybeWithId[]): CartLine[] {
  return lines.map((l) => ({ ...l, id: l.id || crypto.randomUUID() }));
}

type CartState = {
  lines: CartLine[];
  discount: CartDiscount;
  loyaltyRedeem: LoyaltyRedeem;
  shipping: number;
  customerId: string | null;
  customerName: string | null;
  heldCartId: string | null;
  addItem: (
    item: {
      sku: string;
      name: string;
      unitPrice: number;
      purchasePrice?: number;
      scaleWeight?: number;
      displayRatePerKg?: number;
      isScaleItem?: boolean;
      isReturnable?: boolean;
      trackSerial?: boolean;
      trackBatch?: boolean;
      batchNumber?: string;
      serialNumbers?: string[];
    },
    initialQty?: number,
  ) => void;
  removeItem: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  setLineScaleWeight: (id: string, scaleWeight: number) => void;
  setLineBatch: (id: string, batchNumber: string) => void;
  setLineSerials: (id: string, serialNumbers: string[]) => void;
  setLinePriceOverride: (id: string, override: LinePriceOverride | null) => void;
  setLineDiscount: (id: string, discount: LineDiscount | null) => void;
  setLineDescription: (id: string, description: string | null) => void;
  setLineLotExpiry: (id: string, lotExpiry: string | null) => void;
  setLineUnit: (id: string, unit: string | null) => void;
  setDiscount: (discount: CartDiscount) => void;
  applyLoyaltyRedeem: (points: number, value: number) => void;
  clearLoyaltyRedeem: () => void;
  setShipping: (shipping: number) => void;
  setCustomer: (customer: { id: string; name: string } | null) => void;
  setHeldCartId: (id: string | null) => void;
  loadHeldCart: (data: {
    id: string;
    lines: CartLineMaybeWithId[];
    discount: CartDiscount;
    shipping: number;
    customerId: string | null;
    customerName: string | null;
  }) => void;
  loadQuotationItems: (data: {
    lines: CartLineMaybeWithId[];
    customerId: string | null;
    customerName: string | null;
  }) => void;
  clear: () => void;
};

// Plain in-memory Zustand store — survives client-side navigation between
// /pos and /pos/payment (Next.js App Router doesn't full-reload for
// internal links), but not a hard page refresh.
export const useCartStore = create<CartState>((set) => ({
  lines: [],
  discount: null,
  loyaltyRedeem: null,
  shipping: 0,
  customerId: null,
  customerName: null,
  heldCartId: null,
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
      lines: withLineIds(data.lines),
      discount: data.discount,
      loyaltyRedeem: null,
      shipping: data.shipping,
      customerId: data.customerId,
      customerName: data.customerName,
    }),
  loadQuotationItems: (data) =>
    set({
      lines: withLineIds(data.lines),
      customerId: data.customerId,
      customerName: data.customerName,
      discount: null,
      loyaltyRedeem: null,
      shipping: 0,
    }),
  addItem: (item, initialQty = 1) =>
    set((state) => {
      // Scale-weighed and serial-tracked items never merge into an
      // existing line, even when the SKU matches — each is its own
      // physical event (a distinct weighing, a distinct serialized unit)
      // carrying its own weight/serial that a merged qty count can't
      // represent. Merging used to silently keep only the FIRST scan's
      // weight/serial and just bump qty, which meant re-weighing the same
      // product (two bags of the same loose item) or selling two
      // serialized units of the same SKU quietly undercharged or
      // under-tracked the second one.
      if (!item.isScaleItem && !item.trackSerial) {
        const existing = state.lines.find((l) => l.sku === item.sku);
        if (existing) {
          return {
            lines: state.lines.map((l) => (l.id === existing.id ? { ...l, qty: l.qty + initialQty } : l)),
          };
        }
      }
      return { lines: [...state.lines, { ...item, id: crypto.randomUUID(), qty: initialQty }] };
    }),
  removeItem: (id) => set((state) => ({ lines: state.lines.filter((l) => l.id !== id) })),
  setQty: (id, qty) =>
    set((state) => ({
      lines:
        qty <= 0
          ? state.lines.filter((l) => l.id !== id)
          : state.lines.map((l) => (l.id === id ? { ...l, qty } : l)),
    })),
  setLineScaleWeight: (id, scaleWeight) =>
    set((state) => ({
      lines: state.lines.map((l) => (l.id === id ? { ...l, scaleWeight } : l)),
    })),
  setLineBatch: (id, batchNumber) =>
    set((state) => ({
      lines: state.lines.map((l) => (l.id === id ? { ...l, batchNumber } : l)),
    })),
  setLineSerials: (id, serialNumbers) =>
    set((state) => ({
      lines: state.lines.map((l) => (l.id === id ? { ...l, serialNumbers } : l)),
    })),
  setLinePriceOverride: (id, override) =>
    set((state) => ({
      lines: state.lines.map((l) => (l.id === id ? { ...l, priceOverride: override } : l)),
    })),
  setLineDiscount: (id, discount) =>
    set((state) => ({
      lines: state.lines.map((l) => (l.id === id ? { ...l, lineDiscount: discount } : l)),
    })),
  setLineDescription: (id, description) =>
    set((state) => ({
      lines: state.lines.map((l) => (l.id === id ? { ...l, description } : l)),
    })),
  setLineLotExpiry: (id, lotExpiry) =>
    set((state) => ({
      lines: state.lines.map((l) => (l.id === id ? { ...l, lotExpiry } : l)),
    })),
  setLineUnit: (id, unit) =>
    set((state) => ({
      lines: state.lines.map((l) => (l.id === id ? { ...l, unit } : l)),
    })),
  clear: () =>
    set({ lines: [], discount: null, loyaltyRedeem: null, shipping: 0, customerId: null, customerName: null, heldCartId: null }),
}));

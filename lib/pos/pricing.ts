// Pure pricing functions — no DB/IO — so calculateCart/applyDiscount are
// trivially reusable from both the API routes and (later) any offline
// client-side calculation. Keep the API route as the source of truth for
// looking up unitPrice/taxRate from the DB; these functions just do math.

export type CartLineInput = {
  sku: string;
  qty: number;
  unitPrice: number;
  /** absolute discount amount for this line, not a percent */
  discount?: number;
  /** Optional purchase/cost price to enforce margin protection floor */
  purchasePrice?: number;
  /** Optional scale weight in kg (for variable weight items) */
  scaleWeight?: number;
  /** Allow selling below cost with supervisor authorization */
  allowBelowCost?: boolean;
};

export type CalculatedLine = {
  sku: string;
  qty: number;
  unitPrice: number;
  discount: number;
  lineSubtotal: number;
  taxAmount: number;
  scaleWeight?: number;
  marginClamped?: boolean;
};

export type CartCalculation = {
  lines: CalculatedLine[];
  subtotal: number;
  totalDiscount: number;
  tax: number;
  shipping: number;
  total: number;
};

export type DiscountStackingPolicy = "additive_capped" | "exclusive" | "compounding";

export const MAX_DISCOUNT_PERCENT_CAP = 80; // Default maximum discount cap 80%

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function calculateTax(lineSubtotal: number, taxRate: number): number {
  return round2(lineSubtotal * taxRate);
}

/**
 * Clamps discount to obey cost margin floor (cannot sell below purchasePrice unless authorized)
 * and never exceed line total.
 */
export function clampDiscountWithCostFloor(params: {
  lineTotal: number;
  discountAmount: number;
  qty: number;
  purchasePrice?: number;
  allowBelowCost?: boolean;
}): { discount: number; marginClamped: boolean } {
  const { lineTotal, discountAmount, qty, purchasePrice, allowBelowCost } = params;
  let maxDiscount = lineTotal;
  let marginClamped = false;

  // If purchase price is known and below-cost sales are NOT authorized, enforce cost floor
  if (purchasePrice !== undefined && purchasePrice > 0 && !allowBelowCost) {
    const totalCost = round2(purchasePrice * qty);
    const maxAllowedDiscount = round2(Math.max(0, lineTotal - totalCost));
    if (discountAmount > maxAllowedDiscount) {
      maxDiscount = maxAllowedDiscount;
      marginClamped = true;
    }
  }

  // Also enforce overall discount percentage cap (e.g. max 80% off list price)
  const maxCapDiscount = round2(lineTotal * (MAX_DISCOUNT_PERCENT_CAP / 100));
  maxDiscount = Math.min(maxDiscount, maxCapDiscount);

  const finalDiscount = round2(Math.max(0, Math.min(discountAmount, maxDiscount)));
  return {
    discount: finalDiscount,
    marginClamped: marginClamped || (discountAmount > maxDiscount),
  };
}

export function calculateCart(
  items: CartLineInput[],
  taxRate: number,
  shipping = 0,
): CartCalculation {
  const lines: CalculatedLine[] = items.map((item) => {
    const lineTotal = round2(item.qty * item.unitPrice);
    const { discount, marginClamped } = clampDiscountWithCostFloor({
      lineTotal,
      discountAmount: item.discount ?? 0,
      qty: item.qty,
      purchasePrice: item.purchasePrice,
      allowBelowCost: item.allowBelowCost,
    });

    const lineSubtotal = round2(lineTotal - discount);
    const taxAmount = calculateTax(lineSubtotal, taxRate);
    return {
      sku: item.sku,
      qty: item.qty,
      unitPrice: item.unitPrice,
      discount,
      lineSubtotal,
      taxAmount,
      scaleWeight: item.scaleWeight,
      marginClamped,
    };
  });

  const subtotal = round2(lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0));
  const totalDiscount = round2(lines.reduce((sum, l) => sum + l.discount, 0));
  const tax = round2(lines.reduce((sum, l) => sum + l.taxAmount, 0));
  const shippingAmount = round2(Math.max(shipping, 0));
  // Shipping is added straight to the total — not taxed, not discounted.
  const total = round2(subtotal - totalDiscount + tax + shippingAmount);

  return { lines, subtotal, totalDiscount, tax, shipping: shippingAmount, total };
}

export type DiscountInput =
  | { scope: "cart"; type: "percent"; value: number }
  | { scope: "cart"; type: "amount"; value: number }
  | { scope: "line"; lineIndex: number; type: "percent"; value: number }
  | { scope: "line"; lineIndex: number; type: "amount"; value: number };

/** Applies a discount to cart line inputs with stacking policy and cost floor.
 *
 * A line-scoped discount targets a line by its array index, not by sku —
 * two lines can share a sku (scale-weighed items, serialized units each
 * get their own line; see cart-store.ts's addItem), and matching by sku
 * would apply a discount meant for one specific line to every line that
 * happens to share its sku. */
export function applyDiscount(
  items: CartLineInput[],
  discount: DiscountInput,
  policy: DiscountStackingPolicy = "additive_capped",
): CartLineInput[] {
  if (discount.scope === "line") {
    return items.map((item, idx) => {
      if (idx !== discount.lineIndex) return item;
      const lineTotal = item.qty * item.unitPrice;
      const amount = discount.type === "percent" ? lineTotal * (discount.value / 100) : discount.value;
      
      let combined = 0;
      const existingDiscount = item.discount ?? 0;

      if (policy === "exclusive") {
        // Highest discount wins
        combined = Math.max(existingDiscount, amount);
      } else if (policy === "compounding") {
        // Apply on top of already-discounted net
        const remaining = Math.max(0, lineTotal - existingDiscount);
        const nextAmount = discount.type === "percent" ? remaining * (discount.value / 100) : Math.min(amount, remaining);
        combined = existingDiscount + nextAmount;
      } else {
        // additive_capped
        combined = existingDiscount + amount;
      }

      const { discount: finalDiscount } = clampDiscountWithCostFloor({
        lineTotal,
        discountAmount: combined,
        qty: item.qty,
        purchasePrice: item.purchasePrice,
        allowBelowCost: item.allowBelowCost,
      });

      return { ...item, discount: finalDiscount };
    });
  }

  // cart scope: distribute proportionally across lines by pre-discount value
  const cartTotal = items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0);
  if (cartTotal <= 0) return items;
  const cartDiscountAmount =
    discount.type === "percent" ? cartTotal * (discount.value / 100) : discount.value;

  return items.map((item) => {
    const lineTotal = item.qty * item.unitPrice;
    const share = round2((lineTotal / cartTotal) * Math.min(cartDiscountAmount, cartTotal));
    const combined = (item.discount ?? 0) + share;

    const { discount: finalDiscount } = clampDiscountWithCostFloor({
      lineTotal,
      discountAmount: combined,
      qty: item.qty,
      purchasePrice: item.purchasePrice,
      allowBelowCost: item.allowBelowCost,
    });

    return { ...item, discount: finalDiscount };
  });
}

export type LineWithOverrides = {
  sku: string;
  qty: number;
  unitPrice: number;
  purchasePrice?: number;
  scaleWeight?: number;
  allowBelowCost?: boolean;
  priceOverride?: { newPrice: number; reason: string } | null;
  lineDiscount?: { type: "percent" | "amount"; value: number } | null;
};

/** Applies each line's own price override (if any) and line-scoped discount (if any). */
export function applyLineOverridesAndDiscounts(lines: LineWithOverrides[]): CartLineInput[] {
  let result: CartLineInput[] = lines.map((l) => ({
    sku: l.sku,
    qty: l.qty,
    unitPrice: l.priceOverride ? l.priceOverride.newPrice : l.unitPrice,
    purchasePrice: l.purchasePrice,
    scaleWeight: l.scaleWeight,
    allowBelowCost: l.allowBelowCost,
  }));
  lines.forEach((l, idx) => {
    if (!l.lineDiscount) return;
    result = applyDiscount(result, { scope: "line", lineIndex: idx, type: l.lineDiscount.type, value: l.lineDiscount.value });
  });
  return result;
}


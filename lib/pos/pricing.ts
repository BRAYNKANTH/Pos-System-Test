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
};

export type CalculatedLine = {
  sku: string;
  qty: number;
  unitPrice: number;
  discount: number;
  lineSubtotal: number;
  taxAmount: number;
};

export type CartCalculation = {
  lines: CalculatedLine[];
  subtotal: number;
  totalDiscount: number;
  tax: number;
  shipping: number;
  total: number;
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function calculateTax(lineSubtotal: number, taxRate: number): number {
  return round2(lineSubtotal * taxRate);
}

export function calculateCart(
  items: CartLineInput[],
  taxRate: number,
  shipping = 0,
): CartCalculation {
  const lines: CalculatedLine[] = items.map((item) => {
    const discount = round2(Math.min(item.discount ?? 0, item.qty * item.unitPrice));
    const lineSubtotal = round2(item.qty * item.unitPrice - discount);
    const taxAmount = calculateTax(lineSubtotal, taxRate);
    return {
      sku: item.sku,
      qty: item.qty,
      unitPrice: item.unitPrice,
      discount,
      lineSubtotal,
      taxAmount,
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
  | { scope: "line"; sku: string; type: "percent"; value: number }
  | { scope: "line"; sku: string; type: "amount"; value: number };

/** Applies a discount to cart line inputs and returns new line inputs
 * ready for calculateCart. Percent discounts are computed against that
 * line's (or, for cart scope, the whole cart's) pre-discount subtotal.
 * Adds onto any discount already present on the line (e.g. an
 * auto-applied scheduled Discount resolved via lib/pos/discounts.ts)
 * rather than overwriting it, so a manual cashier discount stacks with
 * an active promo instead of silently erasing it — still clamped so the
 * combined discount never exceeds the line's own total. */
export function applyDiscount(
  items: CartLineInput[],
  discount: DiscountInput,
): CartLineInput[] {
  if (discount.scope === "line") {
    return items.map((item) => {
      if (item.sku !== discount.sku) return item;
      const lineTotal = item.qty * item.unitPrice;
      const amount = discount.type === "percent" ? lineTotal * (discount.value / 100) : discount.value;
      const combined = (item.discount ?? 0) + amount;
      return { ...item, discount: round2(Math.min(combined, lineTotal)) };
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
    return { ...item, discount: round2(Math.min(combined, lineTotal)) };
  });
}

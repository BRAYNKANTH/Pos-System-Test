import { prisma } from "@/lib/prisma";

export type ResolvedDiscount = {
  id: string;
  name: string;
  /** Absolute discount for this line's full qty × unitPrice, already
   * clamped to not exceed the line total. */
  amountForLine: number;
};

/** Finds the highest-priority (lowest `priority` number) active,
 * in-date-range Discount applicable to a cart line — matched by an
 * explicit product list first, then brand, then category. This is what
 * makes the Discounts admin page (previously just a management UI with
 * nothing reading from it) actually affect real sales: checkout and the
 * cart-preview endpoint both call this per line before computing totals.
 * "Fixed" discounts are per-unit (qty × amount); "Percentage" discounts
 * are off the line's pre-discount total. */
export async function resolveLineDiscount(params: {
  sku: string;
  category: string | null;
  brand: string | null;
  qty: number;
  unitPrice: number;
}): Promise<ResolvedDiscount | null> {
  const now = new Date();
  const lineTotal = params.qty * params.unitPrice;
  if (lineTotal <= 0) return null;

  const discounts = await prisma.discount.findMany({
    where: { isActive: true, startsAt: { lte: now }, endsAt: { gte: now } },
    orderBy: { priority: "asc" },
  });

  for (const d of discounts) {
    const products = Array.isArray(d.products) ? (d.products as { sku?: string }[]) : [];
    const matchesSku = products.some((p) => p.sku === params.sku);
    const matchesBrand = Boolean(d.brand) && d.brand === params.brand;
    const matchesCategory = Boolean(d.category) && d.category === params.category;
    if (!matchesSku && !matchesBrand && !matchesCategory) continue;

    const rawAmount =
      d.discountType === "Percentage"
        ? lineTotal * (Number(d.discountAmount) / 100)
        : Number(d.discountAmount) * params.qty;

    return { id: d.id, name: d.name, amountForLine: Math.min(Math.max(rawAmount, 0), lineTotal) };
  }
  return null;
}

/** Batch version — one query for the active discount list, then matches
 * every line against it in memory instead of one query per line. */
export async function resolveDiscountsForLines(
  lines: { sku: string; category: string | null; brand: string | null; qty: number; unitPrice: number }[],
): Promise<Map<string, ResolvedDiscount>> {
  const now = new Date();
  const discounts = await prisma.discount.findMany({
    where: { isActive: true, startsAt: { lte: now }, endsAt: { gte: now } },
    orderBy: { priority: "asc" },
  });

  const result = new Map<string, ResolvedDiscount>();
  for (const line of lines) {
    const lineTotal = line.qty * line.unitPrice;
    if (lineTotal <= 0) continue;

    for (const d of discounts) {
      const products = Array.isArray(d.products) ? (d.products as { sku?: string }[]) : [];
      const matchesSku = products.some((p) => p.sku === line.sku);
      const matchesBrand = Boolean(d.brand) && d.brand === line.brand;
      const matchesCategory = Boolean(d.category) && d.category === line.category;
      if (!matchesSku && !matchesBrand && !matchesCategory) continue;

      const rawAmount =
        d.discountType === "Percentage"
          ? lineTotal * (Number(d.discountAmount) / 100)
          : Number(d.discountAmount) * line.qty;

      result.set(line.sku, { id: d.id, name: d.name, amountForLine: Math.min(Math.max(rawAmount, 0), lineTotal) });
      break; // highest-priority match wins, stop scanning for this line
    }
  }
  return result;
}

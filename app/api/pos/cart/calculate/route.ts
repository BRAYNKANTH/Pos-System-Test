import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { calculateCart, type CartLineInput } from "@/lib/pos/pricing";
import { resolveDiscountsForLines } from "@/lib/pos/discounts";

type RequestLine = { sku: string; qty: number };

// calculateCart — POST /api/pos/cart/calculate — compute subtotal,
// discounts, tax per line item. Price and tax rate are always looked up
// server-side (never trust a client-supplied price).
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });

  const body = await req.json().catch(() => null);
  const requestLines: RequestLine[] = Array.isArray(body?.items) ? body.items : [];
  if (requestLines.length === 0) {
    return apiError("INVALID_INPUT", "items[] is required", { status: 400 });
  }

  const skus = requestLines.map((l) => l.sku);
  const inventoryItems = await prisma.inventoryItem.findMany({ where: { sku: { in: skus } } });
  const bySku = new Map(inventoryItems.map((i) => [i.sku, i]));

  const missing = skus.filter((sku) => !bySku.has(sku));
  if (missing.length > 0) {
    return apiError("UNKNOWN_SKU", `Unknown SKU(s): ${missing.join(", ")}`, { status: 400 });
  }

  const autoDiscounts = await resolveDiscountsForLines(
    requestLines.map((l) => {
      const item = bySku.get(l.sku)!;
      return { sku: l.sku, category: item.category, brand: item.brand, qty: l.qty, unitPrice: Number(item.unitPrice) };
    }),
  );

  const lines: CartLineInput[] = requestLines.map((l) => ({
    sku: l.sku,
    qty: l.qty,
    unitPrice: Number(bySku.get(l.sku)!.unitPrice),
    discount: autoDiscounts.get(l.sku)?.amountForLine ?? 0,
  }));

  const taxRule = await prisma.taxRule.findFirst({ where: { isDefault: true } });
  const taxRate = taxRule ? Number(taxRule.rate) : 0;
  const shipping = Number(body?.shipping) || 0;

  return apiSuccess(calculateCart(lines, taxRate, shipping));
}

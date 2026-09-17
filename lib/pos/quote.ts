import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkPermission, PERMISSIONS, type Role } from "@/lib/auth/rbac";
import { calculateCart, applyDiscount } from "./pricing";
import { resolveDiscountsForLines } from "./discounts";
import { pointsToDiscountValue } from "@/lib/customers/loyalty";

const discount = z.object({ type: z.enum(["percent", "amount"]), value: z.number().finite().nonnegative() });
export const quoteSchema = z.object({
  items: z.array(z.object({ sku: z.string().trim().min(1), qty: z.number().int().positive().max(100000),
    scaleWeight: z.number().finite().positive().optional(), batchNumber: z.string().trim().min(1).optional(),
    serialNumbers: z.array(z.string().trim().min(1)).optional(), allowBelowCost: z.boolean().optional(),
    priceOverride: z.object({ newPrice: z.number().finite().nonnegative(), reason: z.string().trim().min(1) }).optional(),
    lineDiscount: discount.optional(),
  })).min(1).max(500),
  discount: discount.extend({ scope: z.literal("cart") }).optional(),
  redeemLoyaltyPoints: z.number().int().nonnegative().optional(),
  shipping: z.number().finite().nonnegative().default(0), customerId: z.string().nullable().optional(),
});
export type QuoteInput = z.infer<typeof quoteSchema>;

export async function quoteSale(input: QuoteInput, role: Role) {
  if (input.items.some(l => l.priceOverride || l.allowBelowCost) && !(await checkPermission(role, PERMISSIONS.PRICE_OVERRIDE))) {
    throw new Error("Manager permission is required to override prices or sell below cost");
  }
  const skus = [...new Set(input.items.map(l => l.sku))];
  const [inventory, batches, taxes, customer, location] = await Promise.all([
    prisma.inventoryItem.findMany({ where: { sku: { in: skus } } }),
    prisma.itemBatch.findMany({ where: { sku: { in: skus } } }),
    prisma.taxRule.findMany({ orderBy: { id: "asc" } }),
    input.customerId ? prisma.customer.findUnique({ where: { id: input.customerId } }) : null,
    prisma.location.findFirst({ where: { isDefault: true } }),
  ]);
  if (input.customerId && !customer) throw new Error("Customer not found");
  const bySku = new Map(inventory.map(i => [i.sku, i]));
  const resolved = input.items.map(l => {
    const product = bySku.get(l.sku);
    if (!product) throw new Error(`Product ${l.sku} not found`);
    if (product.isScaleItem && (!l.scaleWeight || l.qty !== 1)) throw new Error(`Enter the weight for ${product.name}`);
    if (!product.isScaleItem && l.scaleWeight !== undefined) throw new Error(`Weight is not supported for ${product.name}`);
    const batch = l.batchNumber ? batches.find(b => b.sku === l.sku && b.batchNumber === l.batchNumber) : undefined;
    if (product.trackBatch && !batch) throw new Error(`Select an available batch for ${product.name}`);
    if (l.batchNumber && (!batch || (batch.expiryDate && batch.expiryDate < new Date()))) throw new Error(`Batch for ${product.name} is unavailable or expired`);
    const unitRate = l.priceOverride?.newPrice ?? (batch?.unitPrice != null ? Number(batch.unitPrice) : Number(product.unitPrice));
    const weight = product.isScaleItem ? l.scaleWeight! : 1;
    return { sku: l.sku, qty: l.qty, unitPrice: Math.round((l.priceOverride ? l.priceOverride.newPrice : unitRate * weight) * 100) / 100,
      purchasePrice: Number(batch?.costPrice ?? product.purchasePrice) * weight, scaleWeight: l.scaleWeight,
      allowBelowCost: l.allowBelowCost, category: product.category, brand: product.brand, isNetPriceItem: product.isNetPriceItem };
  });
  const automatic = await resolveDiscountsForLines(resolved, { locationName: location?.name, customerGroup: customer?.group });
  let lines = resolved.map((l, i) => ({ ...l, discount: automatic[i]?.amountForLine ?? 0 }));
  input.items.forEach((l, index) => {
    if (l.lineDiscount) lines = applyDiscount(lines, { ...l.lineDiscount, scope: "line", lineIndex: index }).map((line, i) => ({ ...resolved[i], ...line, discount: line.discount ?? 0 }));
  });
  if (input.discount) lines = applyDiscount(lines, input.discount).map((line, i) => ({ ...resolved[i], ...line, discount: line.discount ?? 0 }));
  if (input.redeemLoyaltyPoints) {
    if (!customer || customer.loyaltyPoints < input.redeemLoyaltyPoints) throw new Error("Insufficient loyalty points for this customer");
    lines = applyDiscount(lines, { scope: "cart", type: "amount", value: pointsToDiscountValue(input.redeemLoyaltyPoints) }).map((line, i) => ({ ...resolved[i], ...line, discount: line.discount ?? 0 }));
  }
  const defaultTax = taxes.find(t => t.isDefault);
  const calculation = calculateCart(lines, 0, input.shipping);
  calculation.lines.forEach((line, i) => {
    const rule = taxes.find(t => t.category === resolved[i].category && (t.region === location?.country || t.region === "default")) ?? defaultTax;
    // Existing tax settings store both displayed fixed amounts and percentages divided by 100.
    line.taxAmount = rule ? Math.round((rule.rateType === "Fixed" ? Number(rule.rate) * 100 * line.qty : line.lineSubtotal * Number(rule.rate)) * 100) / 100 : 0;
  });
  calculation.tax = Math.round(calculation.lines.reduce((sum, l) => sum + l.taxAmount, 0) * 100) / 100;
  calculation.total = Math.round((calculation.subtotal - calculation.totalDiscount + calculation.tax + calculation.shipping) * 100) / 100;
  return { calculation, inventory, customer, location };
}

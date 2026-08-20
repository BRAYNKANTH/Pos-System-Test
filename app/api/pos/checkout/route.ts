import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";
import { calculateCart, applyDiscount, type CartLineInput, type DiscountInput } from "@/lib/pos/pricing";
import { resolveDiscountsForLines } from "@/lib/pos/discounts";
import { deductStockOnSale, syncLocationStockAfterSale, InsufficientStockError } from "@/lib/inventory/stock";
import { enqueueSyncJob } from "@/lib/sync/enqueueSyncJob";
import { writeAuditLog } from "@/lib/audit/writeAuditLog";
import { calculateEarnedPoints, calculateLoyaltyTier, pointsToDiscountValue } from "@/lib/customers/loyalty";

type LineDiscount = { type: "percent" | "amount"; value: number };
type PriceOverride = { newPrice: number; reason: string };
type RequestLine = { sku: string; qty: number; priceOverride?: PriceOverride; lineDiscount?: LineDiscount };
// giftCardCode carries the voucher code for a "gift_card" tender — kept
// off the persisted PaymentTender row (schema has no column for it) but
// used here to validate and atomically deduct the real balance instead of
// accepting the tender at face value with nothing behind it.
type Tender = { method: string; amount: number; giftCardCode?: string };

class GiftCardValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GiftCardValidationError";
  }
}

// processPayment — POST /api/pos/checkout — finalize sale. Supports
// split/partial payments via `tenders: {method, amount}[]` (e.g. $20 cash
// + $10 card); a single-method `paymentMethod: "cash"` string is still
// accepted and wrapped into a one-item tenders array for backward
// compatibility. `idempotencyKey` is supplied by the client (so a retried
// request after a dropped response is safe) and enforced unique at the DB
// level.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });

  const body = await req.json().catch(() => null);
  const requestLines: RequestLine[] = Array.isArray(body?.items)
    ? body.items.map((l: RequestLine) => ({
        sku: l.sku,
        qty: l.qty,
        priceOverride:
          l.priceOverride && Number.isFinite(l.priceOverride.newPrice) && l.priceOverride.newPrice >= 0 && l.priceOverride.reason
            ? { newPrice: l.priceOverride.newPrice, reason: String(l.priceOverride.reason).trim() }
            : undefined,
        lineDiscount:
          l.lineDiscount && (l.lineDiscount.type === "percent" || l.lineDiscount.type === "amount") && Number.isFinite(l.lineDiscount.value) && l.lineDiscount.value > 0
            ? l.lineDiscount
            : undefined,
      }))
    : [];
  const idempotencyKey = typeof body?.idempotencyKey === "string" ? body.idempotencyKey : "";
  const registerId = typeof body?.registerId === "string" ? body.registerId : "register-1";
  const discount = body?.discount as DiscountInput | undefined;
  const shipping = Number(body?.shipping) || 0;
  const customerId = typeof body?.customerId === "string" && body.customerId ? body.customerId : null;
  // Points the cashier is spending as a loyalty discount this sale —
  // distinct from `discount` so the customer's point balance actually
  // gets decremented (previously this only ever adjusted the displayed
  // total; nothing ever deducted the points, so the same "discount" could
  // be reapplied indefinitely).
  const redeemLoyaltyPointsRaw = Number(body?.redeemLoyaltyPoints);
  const redeemLoyaltyPoints =
    Number.isFinite(redeemLoyaltyPointsRaw) && redeemLoyaltyPointsRaw > 0 ? Math.floor(redeemLoyaltyPointsRaw) : 0;

  let tenders: Tender[] = Array.isArray(body?.tenders)
    ? body.tenders.map((t: { method?: string; amount?: number; giftCardCode?: string }) => ({
        method: t?.method,
        amount: t?.amount,
        giftCardCode:
          typeof t?.giftCardCode === "string" && t.giftCardCode.trim() ? t.giftCardCode.trim().toUpperCase() : undefined,
      }))
    : [];
  if (tenders.length === 0 && typeof body?.paymentMethod === "string" && body.paymentMethod) {
    tenders = [{ method: body.paymentMethod, amount: Number.POSITIVE_INFINITY }]; // amount validated against total below
  }

  if (requestLines.length === 0 || tenders.length === 0 || !idempotencyKey) {
    return apiError(
      "INVALID_INPUT",
      "items[], tenders[] (or paymentMethod), and idempotencyKey are required",
      { status: 400 },
    );
  }

  const hasPriceOverride = requestLines.some((l) => l.priceOverride);
  if (hasPriceOverride && !(await checkPermission(user.role, PERMISSIONS.PRICE_OVERRIDE))) {
    return apiError("FORBIDDEN", "Not allowed to override prices at checkout", { status: 403 });
  }
  if (tenders.some((t) => !t.method || !Number.isFinite(t.amount) || t.amount <= 0)) {
    // Infinity from the paymentMethod fallback above is intentionally not
    // "finite" — it gets replaced with the real total once known, below.
    if (!(tenders.length === 1 && tenders[0].amount === Number.POSITIVE_INFINITY)) {
      return apiError("INVALID_INPUT", "Each tender needs a method and a positive amount", {
        status: 400,
      });
    }
  }
  const giftCardTenders = tenders.filter((t) => t.method === "gift_card");
  if (giftCardTenders.some((t) => !t.giftCardCode)) {
    return apiError("INVALID_INPUT", "Gift card tenders require a voucher code", { status: 400 });
  }
  if (redeemLoyaltyPoints > 0 && !customerId) {
    return apiError("INVALID_INPUT", "A customer must be selected to redeem loyalty points", { status: 400 });
  }

  // Kicked off now, awaited later — none of these depend on the
  // idempotency/inventory/discount chain below, so running them
  // concurrently instead of after it hides their latency instead of
  // stacking it. On this connection each round trip costs real seconds,
  // so collapsing N sequential queries into fewer concurrent batches is
  // the difference between checkout taking ~10s and ~3-4s.
  const taxRulePromise = prisma.taxRule.findFirst({ where: { isDefault: true } });
  const openSessionPromise = prisma.registerSession.findFirst({ where: { status: "open" } });
  const customerPromise = customerId ? prisma.customer.findUnique({ where: { id: customerId } }) : null;
  const giftCardCodes = [...new Set(giftCardTenders.map((t) => t.giftCardCode!))];
  const giftCardsPromise =
    giftCardCodes.length > 0 ? prisma.giftCard.findMany({ where: { code: { in: giftCardCodes } } }) : null;

  const skus = requestLines.map((l) => l.sku);
  // Also run concurrently with the idempotency check below — in the rare
  // replay case this query's result is simply discarded, which costs
  // nothing extra since it ran in parallel rather than after.
  const inventoryItemsPromise = prisma.inventoryItem.findMany({ where: { sku: { in: skus } } });

  // Idempotent replay: if this exact request already went through, return
  // the same result instead of erroring (safe for offline-retry / double
  // taps).
  const [existing, inventoryItems] = await Promise.all([
    prisma.transaction.findUnique({ where: { idempotencyKey }, include: { items: true, bill: true } }),
    inventoryItemsPromise,
  ]);
  if (existing) {
    return apiSuccess({
      transactionId: existing.id,
      billId: existing.bill?.id,
      total: Number(existing.total),
      replay: true,
    });
  }

  const bySku = new Map(inventoryItems.map((i) => [i.sku, i]));
  const missing = skus.filter((sku) => !bySku.has(sku));
  if (missing.length > 0) {
    return apiError("UNKNOWN_SKU", `Unknown SKU(s): ${missing.join(", ")}`, { status: 400 });
  }

  // Auto-apply any active scheduled Discount (Discounts settings page)
  // matching each line's sku/brand/category before the optional manual
  // cashier-entered discount stacks on top (see applyDiscount).
  const autoDiscounts = await resolveDiscountsForLines(
    requestLines.map((l) => {
      const item = bySku.get(l.sku)!;
      return { sku: l.sku, category: item.category, brand: item.brand, qty: l.qty, unitPrice: Number(item.unitPrice) };
    }),
  );

  // Price overrides (damaged item, manager discretion — gated by
  // PRICE_OVERRIDE above) replace the catalog price for that line only;
  // the catalog price is kept below for the audit trail and
  // TransactionItem.originalUnitPrice.
  const overridesBySku = new Map(
    requestLines.filter((l) => l.priceOverride).map((l) => [l.sku, l.priceOverride!]),
  );

  let lines: CartLineInput[] = requestLines.map((l) => ({
    sku: l.sku,
    qty: l.qty,
    unitPrice: overridesBySku.has(l.sku) ? overridesBySku.get(l.sku)!.newPrice : Number(bySku.get(l.sku)!.unitPrice),
    discount: autoDiscounts.get(l.sku)?.amountForLine ?? 0,
  }));

  // Per-line manual discounts (separate control from the cart-level
  // `discount` below) — applied one sku at a time; applyDiscount's line
  // scope only ever touches the matching sku, and stacks additively with
  // whatever's already on that line (see applyDiscount's own docs).
  for (const l of requestLines) {
    if (!l.lineDiscount) continue;
    lines = applyDiscount(lines, { scope: "line", sku: l.sku, type: l.lineDiscount.type, value: l.lineDiscount.value });
  }

  if (discount) lines = applyDiscount(lines, discount);

  const [taxRule, openSession, customer, giftCards] = await Promise.all([
    taxRulePromise,
    openSessionPromise,
    customerPromise,
    giftCardsPromise,
  ]);
  if (customerId && !customer) return apiError("UNKNOWN_CUSTOMER", "Customer not found", { status: 400 });

  // Validate every referenced gift card exists and is redeemable (balance
  // sufficiency is checked further down, once tender amounts are final —
  // the single-tender `paymentMethod` fallback's amount isn't known yet).
  if (giftCardCodes.length > 0) {
    const giftCardByCode = new Map((giftCards ?? []).map((g) => [g.code, g]));
    for (const code of giftCardCodes) {
      const gc = giftCardByCode.get(code);
      if (!gc) return apiError("INVALID_GIFT_CARD", `Gift card code '${code}' not found`, { status: 400 });
      if (gc.status === "deactivated") {
        return apiError("INVALID_GIFT_CARD", `Gift card '${code}' has been deactivated`, { status: 400 });
      }
      if (gc.expiresAt && new Date() > new Date(gc.expiresAt)) {
        return apiError("INVALID_GIFT_CARD", `Gift card '${code}' has expired`, { status: 400 });
      }
    }
  }

  // Loyalty point redemption — validated against the real balance and
  // applied as a cart discount alongside any manual/scheduled discount
  // (see cart-store's applyLoyaltyRedeem for why this is a separate field
  // from `discount` rather than folded into it).
  if (redeemLoyaltyPoints > 0) {
    if (!customer) return apiError("UNKNOWN_CUSTOMER", "Customer not found", { status: 400 });
    if (customer.loyaltyPoints < redeemLoyaltyPoints) {
      return apiError(
        "INSUFFICIENT_LOYALTY_POINTS",
        `Customer only has ${customer.loyaltyPoints} loyalty points (requested ${redeemLoyaltyPoints})`,
        { status: 400 },
      );
    }
    const loyaltyDiscountValue = pointsToDiscountValue(redeemLoyaltyPoints);
    lines = applyDiscount(lines, { scope: "cart", type: "amount", value: loyaltyDiscountValue });
  }

  const taxRate = taxRule ? Number(taxRule.rate) : 0;
  const calculation = calculateCart(lines, taxRate, shipping);

  // Resolve the single-tender fallback's placeholder amount now that the
  // real total is known.
  if (tenders.length === 1 && tenders[0].amount === Number.POSITIVE_INFINITY) {
    tenders = [{ method: tenders[0].method, amount: calculation.total }];
  }

  const tenderedTotal = Math.round(tenders.reduce((sum, t) => sum + t.amount, 0) * 100) / 100;
  if (tenderedTotal < calculation.total) {
    return apiError(
      "INSUFFICIENT_TENDER",
      `Tendered $${tenderedTotal.toFixed(2)} is less than total $${calculation.total.toFixed(2)}`,
      { status: 400 },
    );
  }
  const paymentMethod = tenders.length > 1 ? "split" : tenders[0].method;

  // Balance sufficiency, now that every tender's real amount is known
  // (the single-tender fallback's Infinity placeholder is resolved above).
  if (giftCardCodes.length > 0) {
    const giftCardByCode = new Map((giftCards ?? []).map((g) => [g.code, g]));
    for (const t of giftCardTenders) {
      const gc = giftCardByCode.get(t.giftCardCode!)!;
      if (Number(gc.currentBalance) < t.amount) {
        return apiError(
          "INVALID_GIFT_CARD",
          `Gift card '${t.giftCardCode}' balance (Rs ${Number(gc.currentBalance).toFixed(2)}) is less than the Rs ${t.amount.toFixed(2)} tendered`,
          { status: 400 },
        );
      }
    }
  }

  // openSession (resolved above, in parallel with taxRule/customer): links
  // to the currently open till, if any — sales don't require one to be
  // open (registerId string label keeps working standalone either way),
  // but linking it is what lets the register-close cash count reconcile
  // real cash sales against the float.

  try {
    const result = await prisma.$transaction(async (tx) => {
      for (const line of calculation.lines) {
        await deductStockOnSale(tx, line.sku, line.qty);
      }

      const transaction = await tx.transaction.create({
        data: {
          registerId,
          registerSessionId: openSession?.id,
          cashierId: user.id,
          customerId,
          subtotal: calculation.subtotal,
          tax: calculation.tax,
          shipping: calculation.shipping,
          total: calculation.total,
          paymentMethod,
          idempotencyKey,
          // createMany (not create) — one batched INSERT for however
          // many line items/tenders there are, instead of one INSERT per
          // row. On a connection where every round trip costs real
          // seconds, a 5-item cart with split payment used to mean 7+
          // separate inserts just for these two relations.
          items: {
            createMany: {
              data: calculation.lines.map((line) => {
                const override = overridesBySku.get(line.sku);
                return {
                  sku: line.sku,
                  qty: line.qty,
                  unitPrice: line.unitPrice,
                  discount: line.discount,
                  taxAmount: line.taxAmount,
                  originalUnitPrice: override ? Number(bySku.get(line.sku)!.unitPrice) : undefined,
                  priceOverrideReason: override?.reason,
                };
              }),
            },
          },
          tenders: {
            createMany: {
              data: tenders.map((t) => ({ method: t.method, amount: t.amount })),
            },
          },
        },
      });

      const bill = await tx.bill.create({
        data: { transactionId: transaction.id, status: "locked" },
      });

      // Deduct each redeemed gift card's balance inside the same
      // transaction as the sale — re-checked against the live row here
      // (not just the pre-transaction snapshot above) so a concurrent
      // redemption of the same code can't double-spend it; if it changed
      // underneath us, the whole sale rolls back rather than completing
      // with an unfunded tender.
      for (const t of giftCardTenders) {
        const gc = await tx.giftCard.findUnique({ where: { code: t.giftCardCode! } });
        if (!gc || gc.status === "deactivated" || (gc.expiresAt && new Date() > new Date(gc.expiresAt))) {
          throw new GiftCardValidationError(`Gift card '${t.giftCardCode}' is no longer valid`);
        }
        const newBalance = Number(gc.currentBalance) - t.amount;
        if (newBalance < 0) {
          throw new GiftCardValidationError(`Gift card '${t.giftCardCode}' balance changed and is now insufficient`);
        }
        await tx.giftCard.update({
          where: { id: gc.id },
          data: { currentBalance: newBalance, status: newBalance === 0 ? "redeemed" : gc.status },
        });
      }

      // Earn points on this sale and/or redeem the points spent above —
      // one update, net of both, so a sale that both redeems and earns in
      // the same visit doesn't need two round trips.
      let loyalty: { earned: number; redeemed: number; newBalance: number; tier: string } | null = null;
      if (customerId && customer) {
        const earned = calculateEarnedPoints(calculation.total, customer.loyaltyTier);
        const newPoints = Math.max(0, customer.loyaltyPoints + earned - redeemLoyaltyPoints);
        const newTier = calculateLoyaltyTier(newPoints);
        await tx.customer.update({
          where: { id: customerId },
          data: { loyaltyPoints: newPoints, loyaltyTier: newTier },
        });
        loyalty = { earned, redeemed: redeemLoyaltyPoints, newBalance: newPoints, tier: newTier };
      }

      return { transaction, bill, loyalty };
    }, TRANSACTION_OPTIONS);

    // Fire-and-forget — not awaited, doesn't delay the customer's receipt.
    // See syncLocationStockAfterSale's docs for why this moved out of the
    // transaction above.
    for (const line of calculation.lines) {
      syncLocationStockAfterSale(line.sku, line.qty);
    }

    // Price overrides are audit-logged against the transaction (not the
    // individual TransactionItem — createMany above doesn't return the
    // inserted rows' ids) so there's always a record of who charged what
    // and why whenever a line didn't sell at catalog price.
    for (const [sku, override] of overridesBySku) {
      writeAuditLog({
        entityType: "transaction_price_override",
        entityId: result.transaction.id,
        oldValue: { sku, catalogPrice: Number(bySku.get(sku)!.unitPrice) },
        newValue: { sku, overridePrice: override.newPrice },
        actorId: user.id,
        reason: override.reason,
      }).catch((err) => console.error("writeAuditLog failed for price override", result.transaction.id, err));
    }

    // Fire-and-forget, same as the LocationStock sync above — this used
    // to be awaited, which meant a hiccup enqueueing the Zoho sync job
    // could make checkout report CHECKOUT_FAILED to the cashier even
    // though the sale had already committed. It's an independent,
    // best-effort step; the worker polls the queue regardless of timing.
    enqueueSyncJob({
      entityType: "transaction",
      entityId: result.transaction.id,
      payload: {
        transactionId: result.transaction.id,
        total: Number(result.transaction.total),
        paymentMethod: result.transaction.paymentMethod,
      },
    }).catch((err) => console.error("enqueueSyncJob failed for transaction", result.transaction.id, err));

    return apiSuccess({
      transactionId: result.transaction.id,
      billId: result.bill.id,
      total: Number(result.transaction.total),
      changeDue: Math.max(0, Math.round((tenderedTotal - calculation.total) * 100) / 100),
      loyalty: result.loyalty,
      replay: false,
    });
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      return apiError("INSUFFICIENT_STOCK", `Not enough stock for ${err.sku}`, { status: 409 });
    }
    if (err instanceof GiftCardValidationError) {
      return apiError("INVALID_GIFT_CARD", err.message, { status: 409 });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // Concurrent request with the same idempotency key won the race —
      // fetch and return what it created.
      const winner = await prisma.transaction.findUnique({
        where: { idempotencyKey },
        include: { bill: true },
      });
      if (winner) {
        return apiSuccess({
          transactionId: winner.id,
          billId: winner.bill?.id,
          total: Number(winner.total),
          replay: true,
        });
      }
    }
    console.error("checkout failed", err);
    return apiError("CHECKOUT_FAILED", "Checkout failed. Please try again.", { status: 500 });
  }
}

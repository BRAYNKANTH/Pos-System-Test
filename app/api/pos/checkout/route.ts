import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { calculateCart, applyDiscount, type CartLineInput, type DiscountInput } from "@/lib/pos/pricing";
import { resolveDiscountsForLines } from "@/lib/pos/discounts";
import { deductStockOnSale, syncLocationStockAfterSale, InsufficientStockError } from "@/lib/inventory/stock";
import { enqueueSyncJob } from "@/lib/sync/enqueueSyncJob";

type RequestLine = { sku: string; qty: number };
type Tender = { method: string; amount: number };

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
  const requestLines: RequestLine[] = Array.isArray(body?.items) ? body.items : [];
  const idempotencyKey = typeof body?.idempotencyKey === "string" ? body.idempotencyKey : "";
  const registerId = typeof body?.registerId === "string" ? body.registerId : "register-1";
  const discount = body?.discount as DiscountInput | undefined;
  const shipping = Number(body?.shipping) || 0;
  const customerId = typeof body?.customerId === "string" && body.customerId ? body.customerId : null;

  let tenders: Tender[] = Array.isArray(body?.tenders) ? body.tenders : [];
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
  if (tenders.some((t) => !t.method || !Number.isFinite(t.amount) || t.amount <= 0)) {
    // Infinity from the paymentMethod fallback above is intentionally not
    // "finite" — it gets replaced with the real total once known, below.
    if (!(tenders.length === 1 && tenders[0].amount === Number.POSITIVE_INFINITY)) {
      return apiError("INVALID_INPUT", "Each tender needs a method and a positive amount", {
        status: 400,
      });
    }
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

  let lines: CartLineInput[] = requestLines.map((l) => ({
    sku: l.sku,
    qty: l.qty,
    unitPrice: Number(bySku.get(l.sku)!.unitPrice),
    discount: autoDiscounts.get(l.sku)?.amountForLine ?? 0,
  }));
  if (discount) lines = applyDiscount(lines, discount);

  const [taxRule, openSession, customer] = await Promise.all([taxRulePromise, openSessionPromise, customerPromise]);
  if (customerId && !customer) return apiError("UNKNOWN_CUSTOMER", "Customer not found", { status: 400 });

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
              data: calculation.lines.map((line) => ({
                sku: line.sku,
                qty: line.qty,
                unitPrice: line.unitPrice,
                discount: line.discount,
                taxAmount: line.taxAmount,
              })),
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

      return { transaction, bill };
    }, TRANSACTION_OPTIONS);

    // Fire-and-forget — not awaited, doesn't delay the customer's receipt.
    // See syncLocationStockAfterSale's docs for why this moved out of the
    // transaction above.
    for (const line of calculation.lines) {
      syncLocationStockAfterSale(line.sku, line.qty);
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
      replay: false,
    });
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      return apiError("INSUFFICIENT_STOCK", `Not enough stock for ${err.sku}`, { status: 409 });
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

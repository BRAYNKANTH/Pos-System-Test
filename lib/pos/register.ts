import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";

// Single-till assumption, matching the rest of the app (one location, one
// POS terminal in practice) — only one RegisterSession can be open at a
// time across the whole business, not per-cashier. Whoever opens it,
// anyone with REGISTER_CLOSE can close it (shift handover without
// needing the same person to open and close).

export class RegisterAlreadyOpenError extends Error {
  constructor() {
    super("A register session is already open");
  }
}

export class NoOpenRegisterError extends Error {
  constructor() {
    super("No register session is currently open");
  }
}

export async function getOpenRegisterSession() {
  return prisma.registerSession.findFirst({
    where: { status: "open" },
    include: { openedBy: { select: { name: true } }, cashMovements: true },
  });
}

export async function openRegisterSession(openedById: string, openingFloat: number) {
  const existing = await getOpenRegisterSession();
  if (existing) throw new RegisterAlreadyOpenError();

  return prisma.registerSession.create({
    data: { openedById, openingFloat },
  });
}

export async function recordCashMovement(params: {
  sessionId: string;
  type: "in" | "out";
  amount: number;
  reason: string;
  createdById: string;
}) {
  const session = await prisma.registerSession.findUnique({ where: { id: params.sessionId } });
  if (!session || session.status !== "open") throw new NoOpenRegisterError();

  return prisma.cashMovement.create({
    data: {
      sessionId: params.sessionId,
      type: params.type,
      amount: params.amount,
      reason: params.reason,
      createdById: params.createdById,
    },
  });
}

/** Net cash actually retained in the drawer from completed sales in this
 * session — checkout accepts (and commonly gets) cash tendered ABOVE the
 * sale total, with the difference handed back as change (see
 * app/api/pos/checkout/route.ts: tenders only need to be >= total, never
 * exactly it). PaymentTender.amount stores what was physically handed
 * over, not what was kept — a customer tendering Rs 500 cash for a Rs 350
 * sale leaves a PaymentTender row of 500, but the till only nets +350.
 * Summing raw tender amounts (as this function used to) overstates
 * expected cash by the total change given out — a real, previously
 * undetected bug in the actual close-register reconciliation, not just a
 * cosmetic report issue. Change is assumed to always come back as cash
 * (there's no mechanism to "return change" via card/wallet), clamped so a
 * transaction's change never exceeds what was actually tendered in cash
 * for it. */
async function computeNetCashFromSales(sessionId: string): Promise<number> {
  const transactions = await prisma.transaction.findMany({
    where: { registerSessionId: sessionId, status: "completed" },
    include: { tenders: true },
  });

  let netCash = 0;
  for (const tx of transactions) {
    const cashTendered = tx.tenders.filter((t) => t.method === "cash").reduce((sum, t) => sum + Number(t.amount), 0);
    const totalTendered = tx.tenders.reduce((sum, t) => sum + Number(t.amount), 0);
    const changeGiven = Math.max(0, totalTendered - Number(tx.total));
    netCash += cashTendered - Math.min(changeGiven, cashTendered);
  }
  return netCash;
}

/** Expected cash in the drawer — the single authoritative formula, used
 * by both the real close-register action (closeRegisterSession, below)
 * and the reconciliation report (getRegisterSummary). Previously this
 * only accounted for opening float + raw cash tenders + cash-in/-out
 * movements — meaning a cash refund, an operating expense, or a cash
 * purchase-due payment paid out of the till during the shift was never
 * subtracted, so the recorded cash difference at close time was wrong
 * (overstated) any time one of those happened. Combined with the
 * change-giving bug fixed in computeNetCashFromSales above, "checking
 * balance when closing" was structurally broken in two separate ways. */
export async function computeExpectedCash(sessionId: string): Promise<number> {
  const session = await prisma.registerSession.findUniqueOrThrow({ where: { id: sessionId } });
  const windowEnd = session.closedAt ?? new Date();

  const [netCash, movements, refunds, expenses, cashPurchasesPaid] = await Promise.all([
    computeNetCashFromSales(sessionId),
    prisma.cashMovement.findMany({ where: { sessionId } }),
    prisma.salesReturn.findMany({
      where: { createdAt: { gte: session.openedAt, lte: windowEnd }, refundMethod: "cash" },
    }),
    prisma.expense.findMany({ where: { createdAt: { gte: session.openedAt, lte: windowEnd } } }),
    prisma.purchase.findMany({
      where: { createdAt: { gte: session.openedAt, lte: windowEnd }, amountPaid: { gt: 0 }, paymentMethod: "cash" },
    }),
  ]);

  const cashIn = movements.filter((m) => m.type === "in").reduce((sum, m) => sum + Number(m.amount), 0);
  const cashOut = movements.filter((m) => m.type === "out").reduce((sum, m) => sum + Number(m.amount), 0);
  const cashRefunds = refunds.reduce((sum, r) => sum + Number(r.refundAmount), 0);
  const totalExpense = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const paidPurchaseDue = cashPurchasesPaid.reduce((sum, p) => sum + Number(p.amountPaid), 0);

  return (
    Number(session.openingFloat) + netCash + cashIn - cashOut - cashRefunds - totalExpense - paidPurchaseDue
  );
}

/** getRegisterSummary — the full reconciliation report: payment-method
 * breakdown, sales/refund/expense totals, and an itemized products-sold
 * list (+ by-brand rollup). Used both for the live "Current Register"
 * view (session still open) and the "Register Details" view after
 * closing — same computation either way, just a different closedAt
 * cutoff (now vs. the recorded close time).
 *
 * Only uses this app's real payment methods (cash/card/wallet) — no
 * Cheque/Bank Transfer/Custom Payment rows, since those aren't actual
 * selectable tender types in the checkout flow here. Faking zeroed-out
 * rows for payment methods the app can't actually take would be exactly
 * the kind of "looks complete, does nothing" UI this app has been
 * getting cleaned of all session. */
export async function getRegisterSummary(sessionId: string) {
  const session = await prisma.registerSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: { openedBy: { select: { name: true, email: true } }, closedBy: { select: { name: true } } },
  });
  const windowEnd = session.closedAt ?? new Date();

  const [transactions, refunds, expenses, purchasesPaid] = await Promise.all([
    prisma.transaction.findMany({
      where: { registerSessionId: sessionId },
      include: { tenders: true, items: true },
    }),
    prisma.salesReturn.findMany({
      where: { createdAt: { gte: session.openedAt, lte: windowEnd } },
    }),
    prisma.expense.findMany({
      where: { createdAt: { gte: session.openedAt, lte: windowEnd } },
    }),
    // "Paid Purchase Due" — this app has no incremental payment ledger for
    // purchases (a Purchase row's amountPaid is set once, at creation),
    // so the closest honest read is: purchase orders created — and paid
    // IN CASH — during this shift. A bank-transfer or card purchase
    // payment never touches the till, so it must not reduce expected cash.
    prisma.purchase.findMany({
      where: { createdAt: { gte: session.openedAt, lte: windowEnd }, amountPaid: { gt: 0 }, paymentMethod: "cash" },
    }),
  ]);

  const completed = transactions.filter((t) => t.status === "completed");
  const voided = transactions.filter((t) => t.status === "voided");
  const credit = transactions.filter((t) => t.status !== "completed" && t.status !== "voided");

  // Net of change given, not raw tendered amounts — see
  // computeNetCashFromSales's doc comment above for why: a customer
  // tendering Rs 500 cash for a Rs 350 sale only leaves Rs 350 net, and
  // showing the raw Rs 500 here would silently disagree with the
  // Expected Cash figure below, which correctly nets it out. Card/wallet
  // are never "over-tendered with change" in practice — those are always
  // charged the exact amount owed — so only cash needs the adjustment.
  const paymentBreakdown: Record<string, number> = { cash: 0, card: 0, wallet: 0 };
  for (const tx of completed) {
    const totalTendered = tx.tenders.reduce((sum, t) => sum + Number(t.amount), 0);
    const changeGiven = Math.max(0, totalTendered - Number(tx.total));
    let changeRemaining = changeGiven;
    for (const tender of tx.tenders) {
      const method = tender.method in paymentBreakdown ? tender.method : "cash";
      let amount = Number(tender.amount);
      if (method === "cash" && changeRemaining > 0) {
        const deducted = Math.min(changeRemaining, amount);
        amount -= deducted;
        changeRemaining -= deducted;
      }
      paymentBreakdown[method] += amount;
    }
  }

  const totalSales = completed.reduce((sum, t) => sum + Number(t.total), 0);
  const totalRefund = refunds.reduce((sum, r) => sum + Number(r.refundAmount), 0);
  const refundByMethod: Record<string, number> = {};
  for (const r of refunds) {
    refundByMethod[r.refundMethod] = (refundByMethod[r.refundMethod] ?? 0) + Number(r.refundAmount);
  }
  const totalExpense = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const creditSales = credit.reduce((sum, t) => sum + Number(t.total), 0);
  const paidPurchaseDue = purchasesPaid.reduce((sum, p) => sum + Number(p.amountPaid), 0);
  const totalPayment = totalSales - totalRefund;

  // Products sold — itemized, scoped to completed sales in this session.
  const skuAgg = new Map<string, { sku: string; qty: number; total: number }>();
  for (const tx of completed) {
    for (const item of tx.items) {
      const lineTotal = Number(item.unitPrice) * item.qty - Number(item.discount);
      const existing = skuAgg.get(item.sku);
      if (existing) {
        existing.qty += item.qty;
        existing.total += lineTotal;
      } else {
        skuAgg.set(item.sku, { sku: item.sku, qty: item.qty, total: lineTotal });
      }
    }
  }
  const skus = [...skuAgg.keys()];
  const products = skus.length
    ? await prisma.inventoryItem.findMany({ where: { sku: { in: skus } }, select: { sku: true, name: true, brand: true } })
    : [];
  const productBySku = new Map(products.map((p) => [p.sku, p]));

  const productsSold = [...skuAgg.values()]
    .map((row) => ({
      sku: row.sku,
      name: productBySku.get(row.sku)?.name ?? row.sku,
      brand: productBySku.get(row.sku)?.brand ?? null,
      qty: row.qty,
      total: row.total,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const brandAgg = new Map<string, { qty: number; total: number }>();
  for (const row of productsSold) {
    const key = row.brand ?? "Unbranded";
    const existing = brandAgg.get(key);
    if (existing) {
      existing.qty += row.qty;
      existing.total += row.total;
    } else {
      brandAgg.set(key, { qty: row.qty, total: row.total });
    }
  }
  const productsSoldByBrand = [...brandAgg.entries()]
    .map(([brand, v]) => ({ brand, qty: v.qty, total: v.total }))
    .sort((a, b) => a.brand.localeCompare(b.brand));

  const cashMovements = await prisma.cashMovement.findMany({ where: { sessionId } });
  const cashIn = cashMovements.filter((m) => m.type === "in").reduce((sum, m) => sum + Number(m.amount), 0);
  const cashOut = cashMovements.filter((m) => m.type === "out").reduce((sum, m) => sum + Number(m.amount), 0);

  const openingFloat = Number(session.openingFloat);
  // Delegates to computeExpectedCash — the one authoritative formula also
  // used by the real close-register action — rather than recomputing it
  // here and risking the two drifting apart.
  const expectedCash = await computeExpectedCash(sessionId);

  return {
    session: {
      openedAt: session.openedAt,
      closedAt: session.closedAt,
      openingFloat,
      openedByName: session.openedBy.name,
      openedByEmail: session.openedBy.email,
      closedByName: session.closedBy?.name ?? null,
      status: session.status,
      closingCount: session.closingCount ? Number(session.closingCount) : null,
      cashDifference: session.cashDifference ? Number(session.cashDifference) : null,
    },
    paymentBreakdown,
    refundByMethod,
    totalSales,
    totalRefund,
    totalPayment,
    creditSales,
    totalExpense,
    paidPurchaseDue,
    cashIn,
    cashOut,
    expectedCash,
    voidedCount: voided.length,
    productsSold,
    productsSoldByBrand,
    grandTotalQty: productsSold.reduce((sum, p) => sum + p.qty, 0),
    grandTotalAmount: productsSold.reduce((sum, p) => sum + p.total, 0),
  };
}

export async function closeRegisterSession(params: {
  sessionId: string;
  closedById: string;
  closingCount: number;
  notes?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.registerSession.findUnique({ where: { id: params.sessionId } });
    if (!session || session.status !== "open") throw new NoOpenRegisterError();

    const expectedCash = await computeExpectedCash(params.sessionId);
    const cashDifference = Math.round((params.closingCount - expectedCash) * 100) / 100;

    return tx.registerSession.update({
      where: { id: params.sessionId },
      data: {
        status: "closed",
        closedById: params.closedById,
        closedAt: new Date(),
        closingCount: params.closingCount,
        expectedCash,
        cashDifference,
        notes: params.notes,
      },
    });
  }, TRANSACTION_OPTIONS);
}

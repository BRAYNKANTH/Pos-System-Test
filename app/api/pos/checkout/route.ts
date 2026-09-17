import type { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { quoteSchema, quoteSale } from "@/lib/pos/quote";
import { deductStockOnSale } from "@/lib/inventory/stock";
import { debitDefaultLocationBestEffort } from "@/lib/inventory/locationStock";
import { deductBatchStock } from "@/lib/inventory/batches";
import { validateAndAssignSerials } from "@/lib/inventory/serials";
import { redeemStoreCredit } from "@/lib/customers/storeCredit";
import { calculateEarnedPoints, calculateLoyaltyTier } from "@/lib/customers/loyalty";

const method = z.enum(['cash', 'card', 'wallet', 'gift_card', 'store_credit']);
const schema = quoteSchema.extend({
  idempotencyKey: z.string().min(1).max(128), registerId: z.string().default('register-1'),
  heldCartId: z.string().nullable().optional(), expectedTotal: z.number().finite().nonnegative().optional(),
  offlineCashierId: z.string().optional(), paymentMethod: method.optional(),
  tenders: z.array(z.object({ method, amount: z.number().finite().positive(), giftCardCode: z.string().trim().optional() })).max(20).optional(),
});
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError('UNAUTHENTICATED', 'Login required', { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError('INVALID_INPUT', parsed.error.issues[0].message, { status: 400 });
  const body = parsed.data;
  if (body.offlineCashierId && body.offlineCashierId !== user.id) return apiError('WRONG_CASHIER', 'Sign in as the cashier who recorded this sale to synchronize it', { status: 403 });
  try {
    const existing = await prisma.transaction.findUnique({ where: { idempotencyKey: body.idempotencyKey }, include: { bill: true } });
    if (existing) {
      if (existing.cashierId !== user.id) return apiError('FORBIDDEN', 'This checkout key belongs to another cashier', { status: 403 });
      return apiSuccess({ transactionId: existing.id, billId: existing.bill?.id, total: Number(existing.total), replay: true });
    }
    const { calculation, inventory } = await quoteSale(body, user.role);
    if (body.expectedTotal !== undefined && Math.abs(body.expectedTotal - calculation.total) > 0.009) {
      return apiError('PRICE_CHANGED', 'The sale total has changed. Review the current prices before collecting payment.', { status: 409 });
    }
    const tenders = body.tenders?.length ? body.tenders : body.paymentMethod ? [{ method: body.paymentMethod, amount: calculation.total, giftCardCode: undefined }] : [];
    if (!tenders.length || calculation.total <= 0) return apiError('INVALID_INPUT', 'A positive sale total and payment are required', { status: 400 });
    const tendered = Math.round(tenders.reduce((n, t) => n + t.amount, 0) * 100) / 100;
    const nonCash = tenders.filter(t => t.method !== 'cash').reduce((n, t) => n + t.amount, 0);
    if (tendered < calculation.total || nonCash > calculation.total + 0.009) return apiError('INVALID_TENDER', 'Cover the exact total; change can only be given from cash tendered.', { status: 400 });
    if (tenders.some(t => t.method === 'gift_card' && !t.giftCardCode)) return apiError('INVALID_GIFT_CARD', 'Enter the voucher code', { status: 400 });
    if (tenders.some(t => t.method === 'store_credit') && !body.customerId) return apiError('CUSTOMER_REQUIRED', 'Select the customer whose store credit is being used', { status: 400 });
    const result = await prisma.$transaction(async tx => {
      // pg_advisory_xact_lock returns void — $queryRaw fails trying to
      // deserialize a void-typed result column ("Failed to deserialize
      // column of type 'void'"), breaking every checkout. $executeRaw
      // doesn't attempt to read back any rows, so it's the correct call
      // here: only the lock's side effect matters, never its return value.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${body.idempotencyKey}))`;
      const previous = await tx.transaction.findUnique({ where: { idempotencyKey: body.idempotencyKey }, include: { bill: true } });
      if (previous) {
        if (previous.cashierId !== user.id) throw new Error('Checkout key belongs to another cashier');
        return { transactionId: previous.id, billId: previous.bill?.id, total: Number(previous.total), replay: true };
      }
      if (body.heldCartId) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${body.heldCartId}))`;
        const held = await tx.heldCart.findFirst({ where: { id: body.heldCartId, cashierId: user.id } });
        if (!held) throw new Error('This held sale has already been completed or removed. Refresh the draft list.');
      }
      const session = await tx.registerSession.findFirst({ where: { status: 'open' }, orderBy: { openedAt: 'desc' } });
      // Conditional stock updates and related ledgers commit with the sale.
      for (const line of body.items) {
        const product = inventory.find(i => i.sku === line.sku)!;
        if (product.trackSerial && (line.serialNumbers?.length !== line.qty || new Set(line.serialNumbers).size !== line.qty)) throw new Error('Select exactly one unique serial per unit for ' + product.name);
        await deductStockOnSale(tx, line.sku, line.qty);
        await debitDefaultLocationBestEffort(tx, line.sku, line.qty);
        if (product.trackBatch) await deductBatchStock(tx, line.sku, line.qty, line.batchNumber);
      }
      const transaction = await tx.transaction.create({ data: {
        registerId: body.registerId, registerSessionId: session?.id, cashierId: user.id, customerId: body.customerId,
        subtotal: calculation.subtotal, tax: calculation.tax, shipping: calculation.shipping, total: calculation.total,
        paymentMethod: tenders.length > 1 ? 'split' : tenders[0].method, idempotencyKey: body.idempotencyKey,
        items: { create: calculation.lines.map((line, i) => ({ sku: line.sku, qty: line.qty, unitPrice: line.unitPrice,
          discount: line.discount, taxAmount: line.taxAmount, scaleWeight: body.items[i].scaleWeight,
          batchNumber: body.items[i].batchNumber, serialNumbers: body.items[i].serialNumbers,
          originalUnitPrice: body.items[i].priceOverride ? inventory.find(p => p.sku === line.sku)!.unitPrice : undefined,
          priceOverrideReason: body.items[i].priceOverride?.reason })) },
        tenders: { create: tenders.map(t => ({ method: t.method, amount: t.amount })) },
        bill: { create: { status: 'locked' } },
      }, include: { bill: true } });
      for (const line of body.items) if (line.serialNumbers?.length) await validateAndAssignSerials(tx, line.sku, line.serialNumbers, transaction.id);
      for (const tender of tenders.filter(t => t.method === 'gift_card')) {
        const code = tender.giftCardCode!.toUpperCase();
        const update = await tx.giftCard.updateMany({ where: { code, status: 'active', currentBalance: { gte: tender.amount },
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, data: { currentBalance: { decrement: tender.amount } } });
        if (update.count !== 1) throw new Error('Gift card is invalid, expired, or has insufficient balance');
        await tx.giftCard.updateMany({ where: { code, currentBalance: 0 }, data: { status: 'redeemed' } });
      }
      const credit = tenders.filter(t => t.method === 'store_credit').reduce((n, t) => n + t.amount, 0);
      if (credit > 0) await redeemStoreCredit(tx, body.customerId!, credit, transaction.id);
      if (body.customerId) {
        await tx.$queryRaw`SELECT id FROM customers WHERE id = ${body.customerId} FOR UPDATE`;
        const customer = await tx.customer.findUniqueOrThrow({ where: { id: body.customerId } });
        const redeemed = body.redeemLoyaltyPoints ?? 0;
        if (customer.loyaltyPoints < redeemed) throw new Error('Customer loyalty balance changed. Review the discount.');
        const points = customer.loyaltyPoints - redeemed + calculateEarnedPoints(calculation.total, customer.loyaltyTier);
        await tx.customer.update({ where: { id: customer.id }, data: { loyaltyPoints: points, loyaltyTier: calculateLoyaltyTier(points) } });
      }
      if (body.heldCartId) await tx.heldCart.delete({ where: { id: body.heldCartId } });
      await tx.syncQueueJob.create({ data: { entityType: 'transaction', entityId: transaction.id, payload: { transactionId: transaction.id, total: calculation.total, paymentMethod: transaction.paymentMethod } } });
      for (const line of body.items) if (line.priceOverride) await tx.auditLog.create({ data: { entityType: 'transaction_price_override', entityId: transaction.id,
        actorId: user.id, reason: line.priceOverride.reason, newValue: { sku: line.sku, price: line.priceOverride.newPrice } } });
      return { transactionId: transaction.id, billId: transaction.bill?.id, total: calculation.total, changeDue: Math.round((tendered - calculation.total) * 100) / 100, replay: false };
    }, TRANSACTION_OPTIONS);
    return apiSuccess(result);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error('Checkout database error', error.code);
      return apiError('CHECKOUT_RETRY', 'Checkout could not finish. Retry this payment safely.', { status: 409 });
    }
    return apiError('CHECKOUT_FAILED', error instanceof Error ? error.message : 'Checkout failed', { status: 409 });
  }
}

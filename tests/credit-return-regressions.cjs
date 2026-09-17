const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
let db;
const prisma = new Proxy({}, { get: (_, key) => db[key] });
const originalLoad = Module._load;
Module._load = function(name, ...args) {
  if (name === '@/lib/prisma') return { prisma, TRANSACTION_OPTIONS: {} };
  if (name === '@/lib/audit/writeAuditLog') return { writeAuditLog: async (data, tx) => tx.auditLog.create({ data }) };
  if (name === './locationStock' || name === '@/lib/inventory/locationStock') return {
    creditDefaultLocation: async (tx, sku, qty) => { tx.state.location[sku] = (tx.state.location[sku] ?? 0) + qty; },
    debitDefaultLocationBestEffort: async (tx, sku, qty) => { tx.state.location[sku] = (tx.state.location[sku] ?? 0) - qty; },
  };
  if (name === '@/lib/inventory/stock') return { InsufficientStockError: class extends Error {} };
  if (name.startsWith('@/')) return originalLoad.call(this, path.resolve(__dirname, '..', name.slice(2)), ...args);
  return originalLoad.call(this, name, ...args);
};
const { voidTransaction, AlreadyVoidedError, SaleCannotBeVoidedError } = require('../lib/bills/voidTransaction.ts');
const { approveChangeRequest } = require('../lib/bills/changeRequests.ts');
const { createSalesReturn } = require('../lib/sales/returns.ts');
const { redeemStoreCredit } = require('../lib/customers/storeCredit.ts');
const { computeExpectedCash, getRegisterSummary } = require('../lib/pos/register.ts');
Module._load = originalLoad;

function fixture() {
  let state = {
    sale: { id: 'sale', status: 'completed', customerId: 'customer', total: 200, bill: { id: 'bill', status: 'locked' },
      items: [{ id: 'line', sku: 'A', qty: 2, unitPrice: 100, discount: 0, taxAmount: 0, batchNumber: 'lot', serialNumbers: ['s1', 's2'] }],
      tenders: [{ method: 'store_credit', amount: 200 }] },
    products: { A: { sku: 'A', name: 'Item', qtyOnHand: 0, unitPrice: 100, isReturnable: true, trackBatch: true, trackSerial: true } },
    batches: [{ id: 'batch', sku: 'A', batchNumber: 'lot', qtyOnHand: 0 }],
    serials: ['s1', 's2'].map(serialNumber => ({ sku: 'A', serialNumber, status: 'sold', transactionId: 'sale' })),
    credits: [{ id: 'old-credit', customerId: 'customer', amount: 300, remainingAmount: 100, status: 'active' }],
    redemptions: [{ storeCreditId: 'old-credit', transactionId: 'sale', amount: 200 }],
    returns: [], location: { A: 0 }, adjustments: [], audits: [],
    request: { id: 'request', billId: 'bill', type: 'void', status: 'pending', reason: 'Mistake', requestedBy: 'cashier' },
  };
  const matches = (row, where) => Object.entries(where).every(([key, value]) => row[key] === value);
  const tx = {
    get state() { return state; },
    $queryRaw: async () => [],
    transaction: {
      findUnique: async () => structuredClone(state.sale),
      update: async ({ data }) => Object.assign(state.sale, data),
    },
    bill: { update: async ({ data }) => Object.assign(state.sale.bill, data) },
    billChangeRequest: {
      findUnique: async () => ({ ...state.request, bill: { ...state.sale.bill, transactionId: 'sale', transaction: structuredClone(state.sale) } }),
      update: async ({ data }) => Object.assign(state.request, data),
    },
    inventoryItem: {
      findUnique: async ({ where }) => state.products[where.sku],
      findUniqueOrThrow: async ({ where }) => state.products[where.sku],
      update: async ({ where, data }) => { state.products[where.sku].qtyOnHand += data.qtyOnHand.increment; },
      updateMany: async ({ where, data }) => {
        const p = state.products[where.sku]; if (p.qtyOnHand < where.qtyOnHand.gte) return { count: 0 };
        p.qtyOnHand -= data.qtyOnHand.decrement; return { count: 1 };
      },
    },
    itemBatch: {
      findUnique: async ({ where }) => state.batches.find(b => matches(b, where.sku_batchNumber)),
      updateMany: async ({ where, data }) => {
        const b = state.batches.find(b => Object.entries(where).every(([k, v]) => k === 'qtyOnHand' ? b[k] >= v.gte : b[k] === v));
        if (!b) return { count: 0 }; b.qtyOnHand += data.qtyOnHand.increment ?? -data.qtyOnHand.decrement; return { count: 1 };
      },
    },
    itemSerial: {
      findUnique: async ({ where }) => state.serials.find(s => matches(s, where.sku_serialNumber)),
      updateMany: async ({ where, data }) => { const s = state.serials.find(s => matches(s, where)); if (!s) return { count: 0 }; Object.assign(s, data); return { count: 1 }; },
    },
    stockAdjustment: { create: async ({ data }) => state.adjustments.push(data) },
    auditLog: { create: async ({ data }) => state.audits.push(data) },
    storeCreditRedemption: {
      findMany: async ({ where }) => state.redemptions.filter(r => r.transactionId === where.transactionId).map(r => ({ ...r, storeCredit: state.credits.find(c => c.id === r.storeCreditId) })),
      create: async ({ data }) => state.redemptions.push(data),
    },
    storeCredit: {
      findMany: async ({ where }) => state.credits.filter(c => matches(c, where)).map(c => ({ ...c })),
      create: async ({ data }) => { const c = { id: `credit-${state.credits.length}`, status: 'active', ...data }; state.credits.push(c); return c; },
      updateMany: async ({ where, data }) => { const c = state.credits.find(c => matches(c, where)); if (!c) return { count: 0 }; Object.assign(c, data); return { count: 1 }; },
    },
    salesReturn: {
      findFirst: async () => state.returns[0] ?? null,
      create: async ({ data }) => { const r = { ...data, id: `return-${state.returns.length}`, items: data.items.create }; state.returns.push(r); return r; },
    },
    salesReturnItem: { findMany: async () => state.returns.flatMap(r => r.items) },
  };
  // Emulate transactional rollback and serialization; these are service tests,
  // not a substitute for PostgreSQL integration testing of advisory locks.
  let queue = Promise.resolve();
  tx.$transaction = fn => {
    const result = queue.then(async () => { const snapshot = structuredClone(state); try { return await fn(tx); } catch (error) { state = snapshot; throw error; } });
    queue = result.catch(() => {}); return result;
  };
  db = tx;
  return tx;
}

test('void restores credit, batch, serials and location once; original redemption stays auditable', async () => {
  const tx = fixture();
  await voidTransaction('sale', 'admin');
  assert.equal(tx.state.credits.reduce((n, c) => n + c.remainingAmount, 0), 300);
  assert.equal(tx.state.credits[0].remainingAmount, 100);
  assert.equal(tx.state.redemptions.length, 1);
  assert.equal(tx.state.batches[0].qtyOnHand, 2);
  assert.equal(tx.state.location.A, 2);
  assert.ok(tx.state.serials.every(s => s.status === 'available' && s.transactionId === null));
  await assert.rejects(() => voidTransaction('sale', 'admin'), AlreadyVoidedError);
  assert.equal(tx.state.credits.length, 2);
  assert.equal(tx.state.products.A.qtyOnHand, 2);
});

test('approval void shares reversals and rejects a repeated quick void', async () => {
  const tx = fixture();
  await approveChangeRequest('request', 'admin');
  assert.equal(tx.state.request.status, 'approved');
  assert.equal(tx.state.sale.status, 'voided');
  assert.equal(tx.state.credits.length, 2);
  await assert.rejects(() => voidTransaction('sale', 'admin'), AlreadyVoidedError);
});

test('simultaneous void attempts cannot restore balances or stock twice', async () => {
  const tx = fixture();
  const results = await Promise.allSettled([voidTransaction('sale', 'admin'), voidTransaction('sale', 'admin')]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(tx.state.credits.length, 2);
  assert.equal(tx.state.batches[0].qtyOnHand, 2);
});

test('partial return restores only its receipt units and prevents full void through both paths', async () => {
  const tx = fixture();
  const params = { transactionId: 'sale', items: [{ sku: 'A', qty: 1 }], reason: 'Return', refundMethod: 'store_credit', createdById: 'cashier', confirmedTrackedUnits: true };
  await createSalesReturn(params);
  assert.equal(tx.state.serials[0].status, 'available');
  assert.equal(tx.state.serials[1].status, 'sold');
  assert.equal(tx.state.batches[0].qtyOnHand, 1);
  assert.equal(tx.state.credits[1].amount, 100);
  await assert.rejects(() => voidTransaction('sale', 'admin'), SaleCannotBeVoidedError);
  await assert.rejects(() => approveChangeRequest('request', 'admin'), SaleCannotBeVoidedError);
  assert.equal(tx.state.products.A.qtyOnHand, 1);
  assert.equal(tx.state.credits.length, 2);
  await createSalesReturn(params);
  assert.equal(tx.state.batches[0].qtyOnHand, 2);
  assert.ok(tx.state.serials.every(s => s.status === 'available'));
  await assert.rejects(() => createSalesReturn(params), /exceeds/);
});

test('a return crossing repeated SKU lines restores the correct batches', async () => {
  const tx = fixture();
  tx.state.sale.items.push({ id: 'line2', sku: 'A', qty: 2, unitPrice: 150, batchNumber: 'lot2', serialNumbers: ['s3', 's4'] });
  tx.state.batches.push({ id: 'batch2', sku: 'A', batchNumber: 'lot2', qtyOnHand: 0 });
  tx.state.serials.push(...['s3', 's4'].map(serialNumber => ({ sku: 'A', serialNumber, status: 'sold', transactionId: 'sale' })));
  const result = await createSalesReturn({ transactionId: 'sale', items: [{ sku: 'A', qty: 3 }], reason: 'Return', refundMethod: 'cash', createdById: 'cashier', confirmedTrackedUnits: true });
  assert.equal(result.refundAmount, 350);
  assert.deepEqual(tx.state.batches.map(b => b.qtyOnHand), [2, 1]);
  assert.equal(tx.state.serials[3].status, 'sold');
});

test('serial conflicts roll back all stock and credit changes', async () => {
  const tx = fixture(); tx.state.serials[1].transactionId = 'another-sale';
  await assert.rejects(() => voidTransaction('sale', 'admin'), /no longer sold/);
  assert.equal(tx.state.sale.status, 'completed');
  assert.equal(tx.state.products.A.qtyOnHand, 0);
  assert.equal(tx.state.batches[0].qtyOnHand, 0);
  assert.equal(tx.state.credits.length, 1);
});

test('restored credit remains redeemable even if the original note was cancelled', async () => {
  const tx = fixture(); tx.state.credits[0].status = 'void'; tx.state.credits[0].remainingAmount = 0;
  await voidTransaction('sale', 'admin');
  await tx.$transaction(t => redeemStoreCredit(t, 'customer', 200, 'next-sale'));
  assert.equal(tx.state.credits[0].status, 'void');
  assert.equal(tx.state.credits[1].status, 'used');
  await assert.rejects(() => tx.$transaction(t => redeemStoreCredit(t, 'customer', 1, 'third-sale')), /balance/);
});

test('register keeps tender methods separate and settles exchanges by actual net payment', async () => {
  const tx = fixture();
  const sale = { status: 'completed', total: 300, items: [], tenders: [
    { method: 'store_credit', amount: 100 }, { method: 'gift_card', amount: 50 },
    { method: 'cash', amount: 200 }, { method: 'bank', amount: 25 },
  ] };
  const session = { id: 'session', openingFloat: 100, openedAt: new Date(), status: 'open', openedBy: { name: 'Cashier', email: 'test@example.com' } };
  tx.transaction.findMany = async () => [sale];
  tx.registerSession = { findUniqueOrThrow: async () => session };
  tx.cashMovement = { findMany: async () => [] };
  tx.expense = { findMany: async () => [] };
  tx.purchase = { findMany: async () => [] };
  tx.salesReturn.findMany = async () => [
    { isExchange: false, refundMethod: 'cash', refundAmount: 20 },
    { isExchange: true, refundMethod: 'cash', refundAmount: 100, netPaymentMethod: 'cash', netAmount: 40 },
    { isExchange: true, refundMethod: 'store_credit', refundAmount: 100, netPaymentMethod: 'cash', netAmount: -15 },
    { isExchange: true, refundMethod: 'cash', refundAmount: 100, netPaymentMethod: 'card', netAmount: -30 },
    { isExchange: true, refundMethod: 'cash', refundAmount: 100, netPaymentMethod: 'cash', netAmount: 0 },
    { isExchange: false, refundMethod: 'store_credit', refundAmount: 10 },
  ];
  assert.equal(await computeExpectedCash('session'), 230); // 100 + 125 - 20 + 40 - 15
  const summary = await getRegisterSummary('session');
  assert.deepEqual(summary.paymentBreakdown, { cash: 165, card: 0, wallet: 0, gift_card: 50, store_credit: 100, bank: 25 });
  assert.equal(summary.refundByMethod.cash, 35);
  assert.equal(summary.refundByMethod.card, 30);
  assert.equal(summary.refundByMethod.store_credit, 10);
  assert.equal(summary.totalSales, 340);
  assert.equal(summary.totalRefund, 75);
  assert.equal(summary.totalPayment, 265);
  assert.equal(summary.expectedCash, 230);
});

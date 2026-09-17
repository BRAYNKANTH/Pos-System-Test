const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const products = [
  { sku: 'weight', name: 'Weighted item', isScaleItem: true, unitPrice: 200, purchasePrice: 100, category: 'food' },
  { sku: 'batch', name: 'Batch item', trackBatch: true, unitPrice: 100, purchasePrice: 50, category: 'food' },
];
const mockPrisma = {
  inventoryItem: { findMany: async () => products },
  itemBatch: { findMany: async () => [{ sku: 'batch', batchNumber: 'lot', unitPrice: 120, costPrice: 50 }] },
  taxRule: { findMany: async () => [{ id: 'tax', isDefault: true, rate: 0.1, rateType: 'Percentage' }] },
  location: { findFirst: async () => ({ name: 'Store', country: 'Sri Lanka' }) },
};
const originalLoad = Module._load;
Module._load = function(name, ...args) {
  if (name === '@/lib/prisma') return { prisma: mockPrisma };
  if (name === '@/lib/auth/rbac') return { checkPermission: async () => true, PERMISSIONS: { PRICE_OVERRIDE: 'override' } };
  if (name === './discounts') return { resolveDiscountsForLines: async lines => lines.map(() => null) };
  if (name === '@/lib/customers/loyalty') return { pointsToDiscountValue: points => points };
  return originalLoad.call(this, name, ...args);
};
const { quoteSchema, quoteSale } = require('../lib/pos/quote.ts');
Module._load = originalLoad;

test('checkout input rejects negative, fractional and nonfinite quantities', () => {
  for (const qty of [-1, 0, 0.5, Infinity, NaN]) assert.equal(quoteSchema.safeParse({ items: [{ sku: 'weight', qty }] }).success, false);
});
test('weighed sale uses weight once and computes tax on the resulting charge', async () => {
  const result = await quoteSale(quoteSchema.parse({ items: [{ sku: 'weight', qty: 1, scaleWeight: 0.45 }] }), 'admin');
  assert.equal(result.calculation.subtotal, 90);
  assert.equal(result.calculation.total, 99);
});
test('manual weighted-line override is the charge shown to the cashier', async () => {
  const result = await quoteSale(quoteSchema.parse({ items: [{ sku: 'weight', qty: 1, scaleWeight: 0.45, priceOverride: { newPrice: 80, reason: 'Manager adjustment' } }] }), 'admin');
  assert.equal(result.calculation.subtotal, 80);
});
test('selected batch selling price replaces the catalogue price', async () => {
  const result = await quoteSale(quoteSchema.parse({ items: [{ sku: 'batch', qty: 2, batchNumber: 'lot' }] }), 'admin');
  assert.equal(result.calculation.subtotal, 240);
  await assert.rejects(() => quoteSale(quoteSchema.parse({ items: [{ sku: 'batch', qty: 1 }] }), 'admin'), /Select an available batch/);
});

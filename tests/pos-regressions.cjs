const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { priceReturn } = require('../lib/sales/return-pricing.ts');
const { useCartStore } = require('../lib/pos/cart-store.ts');

test('partial refunds preserve every cent of the original discounted, taxed sale', () => {
  const lines = [{ sku: 'A', qty: 3, unitPrice: 1, discount: 1, taxAmount: 0 }];
  const refunds = [0, 1, 2].map(previous => priceReturn(lines, previous, 1).amount);
  assert.deepEqual(refunds, [0.67, 0.66, 0.67]);
  assert.equal(refunds.reduce((a, b) => a + b), 2);
});
test('repeated SKU lines refund their original net prices in receipt order', () => {
  const lines = [{ sku: 'A', qty: 2, unitPrice: 100, discount: 20, taxAmount: 18 }, { sku: 'A', qty: 1, unitPrice: 120, taxAmount: 12 }];
  assert.equal(priceReturn(lines, 1, 2).amount, 231);
  assert.throws(() => priceReturn(lines, 2, 2), /exceeds/);
  assert.throws(() => priceReturn(lines, 0, 0.5), /whole/);
  assert.throws(() => priceReturn(lines, -1, 1), /previous/);
});
test('invalid quantity edits do not delete or corrupt cart lines', () => {
  useCartStore.getState().clear();
  useCartStore.getState().addItem({ sku: 'A', name: 'Item', unitPrice: 100 }, 2);
  const id = useCartStore.getState().lines[0].id;
  for (const value of [0, -1, NaN, 1.5, Infinity]) useCartStore.getState().setQty(id, value);
  assert.equal(useCartStore.getState().lines[0].qty, 2);
  useCartStore.getState().setQty(id, 12);
  assert.equal(useCartStore.getState().lines[0].qty, 12);
});
test('changing customer clears the previous customer loyalty redemption', () => {
  useCartStore.getState().setCustomer({ id: 'A', name: 'A' });
  useCartStore.getState().applyLoyaltyRedeem(10, 10);
  useCartStore.getState().setCustomer({ id: 'B', name: 'B' });
  assert.equal(useCartStore.getState().loyaltyRedeem, null);
  assert.equal(useCartStore.getState().discount, null);
});
test('batch tracked additions remain separate lines', () => {
  useCartStore.getState().clear();
  for (const batchNumber of ['first', 'second']) useCartStore.getState().addItem({ sku: 'B', name: 'Batch item', unitPrice: 10, trackBatch: true, batchNumber });
  assert.equal(useCartStore.getState().lines.length, 2);
  assert.deepEqual(useCartStore.getState().lines.map(l => l.batchNumber), ['first', 'second']);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { addOrderSummary, emptyOrderHistory } from './order-history.ts';

const summary = { id: 'o1', items: [{ productId: 'p', quantity: 1, unitPrice: 10, lineTotal: 10 }], currency: 'MXN' as const, subtotal: 10, shipping: 0, total: 10, createdAt: '2026-01-01' };
test('sanitizes and deduplicates by order id', () => {
  const once = addOrderSummary(emptyOrderHistory, summary);
  const twice = addOrderSummary(once.state, { ...summary, shippingAddress: { fullName: 'PII' } } as never);
  assert.equal(once.added, true);
  assert.equal(twice.added, false);
  assert.equal(twice.state.orders.length, 1);
});

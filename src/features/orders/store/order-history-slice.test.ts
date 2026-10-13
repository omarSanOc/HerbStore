import assert from 'node:assert/strict';
import test from 'node:test';
import { orderHistoryReducer, orderRecorded } from './order-history-slice.ts';

test('recording the same order leaves one summary', () => {
  const summary = { id: 'o1', items: [], currency: 'MXN' as const, subtotal: 0, shipping: 0, total: 0, createdAt: 'now' };
  const once = orderHistoryReducer(undefined, orderRecorded(summary));
  const twice = orderHistoryReducer(once, orderRecorded(summary));
  assert.equal(twice.orders.length, 1);
});

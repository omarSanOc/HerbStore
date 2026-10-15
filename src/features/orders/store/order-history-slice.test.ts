import assert from 'node:assert/strict';
import test from 'node:test';
import {
  notificationPermissionRequested,
  notificationScheduling,
  notificationUnusable,
  orderHistoryReducer,
  orderRecorded,
} from './order-history-slice.ts';

test('recording the same order leaves one summary', () => {
  const summary = { id: 'o1', items: [], currency: 'MXN' as const, subtotal: 0, shipping: 0, total: 0, createdAt: 'now' };
  const once = orderHistoryReducer(undefined, orderRecorded(summary));
  const twice = orderHistoryReducer(once, orderRecorded(summary));
  assert.equal(twice.orders.length, 1);
});

test('RF-39 notificationUnusable stores the reason of its payload and a retry replaces it', () => {
  const summary = { id: 'o1', items: [], currency: 'MXN' as const, subtotal: 0, shipping: 0, total: 0, createdAt: 'now' };
  const recorded = orderHistoryReducer(orderHistoryReducer(undefined, orderRecorded(summary)), notificationPermissionRequested('o1'));

  const recoverable = orderHistoryReducer(recorded, notificationUnusable({ orderId: 'o1', canOpenSettings: true, reason: 'denied-recoverable' }));
  assert.equal(recoverable.notifications.records.o1?.unusableReason, 'denied-recoverable');

  const retrying = orderHistoryReducer(recoverable, notificationScheduling('o1'));
  assert.equal(retrying.notifications.records.o1?.unusableReason, undefined);

  const blocked = orderHistoryReducer(retrying, notificationUnusable({ orderId: 'o1', canOpenSettings: true, reason: 'blocked' }));
  assert.equal(blocked.notifications.records.o1?.unusableReason, 'blocked');
  assert.equal(recoverable.notifications.records.o1?.unusableReason, 'denied-recoverable', 'the previous state is untouched');
});

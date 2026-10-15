/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { configureStore } from '@reduxjs/toolkit';

import type { OrderSummary } from '../../checkout/contracts/order.ts';
import { sanitizeOrderHistory } from '../../orders/logic/order-history.ts';
import {
  notificationRetryRequested,
  orderHistoryReducer,
  orderRecorded,
} from '../../orders/store/order-history-slice.ts';
import type { OrderNotificationScheduleResult } from '../logic/order-notification-coordinator.ts';
import type { NotificationLanguage } from '../logic/notification-payload.ts';
import { createOrderNotificationListener } from './create-order-notification-listener.ts';

type ScheduleOptions = Readonly<{ requestPermission: boolean }>;
type Outcome = OrderNotificationScheduleResult | Promise<OrderNotificationScheduleResult>;

function summary(id: string): OrderSummary {
  return { id, items: [], currency: 'MXN', subtotal: 0, shipping: 0, total: 0, createdAt: '2026-01-01T00:00:00.000Z' };
}

const SCHEDULED: OrderNotificationScheduleResult = { kind: 'scheduled', identifier: 'notification-1' };

/**
 * The real order-history slice and the real listener over a scripted scheduler. `outcomes` are
 * consumed one per scheduler call (the last one repeats). `preloaded` is a restored (persisted)
 * history: a "restart" is a NEW store and a NEW listener around it, so no module state survives.
 */
function createHarness(options: { outcomes?: Outcome[]; language?: NotificationLanguage; preloaded?: unknown } = {}) {
  const calls: Readonly<{ language: NotificationLanguage; requestPermission: boolean; seen: unknown }>[] = [];
  const outcomes = [...(options.outcomes ?? [SCHEDULED])];
  const listener = createOrderNotificationListener({
    getLanguage: () => options.language ?? 'es',
    schedule: (language: NotificationLanguage, scheduleOptions: ScheduleOptions) => {
      calls.push({
        language,
        requestPermission: scheduleOptions.requestPermission,
        // What the store says AT THE MOMENT the system is about to be invoked.
        seen: structuredClone(store.getState().orderHistory.notifications.records),
      });
      const next = outcomes.length > 1 ? outcomes.shift() : outcomes[0];
      return Promise.resolve(next ?? SCHEDULED);
    },
  });
  const store = configureStore({
    reducer: { orderHistory: orderHistoryReducer },
    ...(options.preloaded === undefined ? {} : { preloadedState: { orderHistory: sanitizeOrderHistory(options.preloaded) } }),
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().prepend(listener.middleware),
  });
  const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
  const record = (id: string) => store.getState().orderHistory.notifications.records[id];

  return { store, calls, settle, record };
}

describe('order notification listener (real slice, scripted scheduler)', () => {
  it('records the access request BEFORE invoking the system and marks the order only after scheduling succeeded', async () => {
    const { store, calls, settle, record } = createHarness({ language: 'en' });

    store.dispatch(orderRecorded(summary('o1')));
    await settle();

    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.language, 'en');
    assert.equal(calls[0]?.requestPermission, true);
    assert.deepEqual(calls[0]?.seen, {
      o1: { permissionRequested: true, notified: false, status: 'scheduling', canOpenSettings: false },
    });
    assert.deepEqual(record('o1'), { permissionRequested: true, notified: true, status: 'scheduled', canOpenSettings: false });
  });

  it('a repeated or recovered idempotent response does not schedule a second notification', async () => {
    const { store, calls, settle } = createHarness();

    store.dispatch(orderRecorded(summary('o1')));
    store.dispatch(orderRecorded(summary('o1')));
    await settle();
    store.dispatch(orderRecorded(summary('o1')));
    await settle();

    assert.equal(calls.length, 1);
    assert.equal(store.getState().orderHistory.orders.length, 1);
  });

  it('a failed schedule leaves the order unmarked and a retry that succeeds marks it, without asking again', async () => {
    const { store, calls, settle, record } = createHarness({
      outcomes: [{ kind: 'failed', error: new Error('native scheduler refused') }, SCHEDULED],
    });

    store.dispatch(orderRecorded(summary('o1')));
    await settle();
    assert.deepEqual(record('o1'), { permissionRequested: true, notified: false, status: 'failed', canOpenSettings: false });

    store.dispatch(notificationRetryRequested('o1'));
    await settle();

    assert.deepEqual(calls.map((call) => call.requestPermission), [true, false]);
    assert.deepEqual(record('o1'), { permissionRequested: true, notified: true, status: 'scheduled', canOpenSettings: false });
  });

  it('a repeated response never retries an order that failed or was unusable: only the explicit retry does', async () => {
    const { store, calls, settle, record } = createHarness({
      outcomes: [{ kind: 'failed', error: new Error('x') }, { kind: 'unusable', canOpenSettings: true, reason: 'blocked' }, SCHEDULED],
    });

    store.dispatch(orderRecorded(summary('o1')));
    await settle();
    store.dispatch(orderRecorded(summary('o1')));
    await settle();
    assert.equal(calls.length, 1, 'the idempotent response does not retry by itself');
    assert.equal(record('o1')?.status, 'failed');

    store.dispatch(notificationRetryRequested('o1'));
    await settle();
    assert.equal(calls.length, 2);
    assert.equal(record('o1')?.status, 'unusable');
  });

  it('once an order is marked, another retry or response never schedules again', async () => {
    const { store, calls, settle } = createHarness();

    store.dispatch(orderRecorded(summary('o1')));
    await settle();
    store.dispatch(notificationRetryRequested('o1'));
    store.dispatch(notificationRetryRequested('o1'));
    store.dispatch(orderRecorded(summary('o1')));
    await settle();

    assert.equal(calls.length, 1);
  });

  it('an unusable result is observable with its Settings hint and a later retry does not request again', async () => {
    const { store, calls, settle, record } = createHarness({
      outcomes: [{ kind: 'unusable', canOpenSettings: true, reason: 'blocked' }, SCHEDULED],
    });

    store.dispatch(orderRecorded(summary('o1')));
    await settle();
    assert.deepEqual(record('o1'), { permissionRequested: true, notified: false, status: 'unusable', canOpenSettings: true, unusableReason: 'blocked' });

    store.dispatch(notificationRetryRequested('o1'));
    await settle();

    assert.deepEqual(calls.map((call) => call.requestPermission), [true, false]);
    assert.equal(record('o1')?.notified, true);
  });

  it('concurrent retries for one order share a single scheduling operation', async () => {
    let release!: (result: OrderNotificationScheduleResult) => void;
    const pending = new Promise<OrderNotificationScheduleResult>((resolve) => { release = resolve; });
    const { store, calls, settle, record } = createHarness({ outcomes: [{ kind: 'failed', error: 'first' }, pending] });

    store.dispatch(orderRecorded(summary('o1')));
    await settle();
    store.dispatch(notificationRetryRequested('o1'));
    store.dispatch(notificationRetryRequested('o1'));
    store.dispatch(notificationRetryRequested('o1'));
    await settle();
    assert.equal(calls.length, 2, 'one initial attempt plus ONE shared retry');
    assert.equal(record('o1')?.status, 'scheduling');

    release(SCHEDULED);
    await settle();
    assert.equal(record('o1')?.notified, true);
    assert.equal(calls.length, 2);
  });

  it('a second order gets its own single request and does not disturb the first', async () => {
    const { store, calls, settle, record } = createHarness();

    store.dispatch(orderRecorded(summary('o1')));
    await settle();
    store.dispatch(orderRecorded(summary('o2')));
    await settle();

    assert.deepEqual(calls.map((call) => call.requestPermission), [true, true]);
    assert.equal(record('o1')?.notified, true);
    assert.equal(record('o2')?.notified, true);
  });

  it('a scheduler that rejects or throws is absorbed: the order stays recorded, unmarked and retryable', async () => {
    const rejecting = createHarness({ outcomes: [Promise.reject(new Error('boom'))] });
    rejecting.store.dispatch(orderRecorded(summary('o1')));
    await rejecting.settle();
    assert.equal(rejecting.store.getState().orderHistory.orders.length, 1);
    assert.deepEqual(rejecting.record('o1'), { permissionRequested: true, notified: false, status: 'failed', canOpenSettings: false });

    const listener = createOrderNotificationListener({
      getLanguage: () => 'es',
      schedule: () => { throw new Error('synchronous native error'); },
    });
    const store = configureStore({
      reducer: { orderHistory: orderHistoryReducer },
      middleware: (getDefaultMiddleware) => getDefaultMiddleware().prepend(listener.middleware),
    });
    store.dispatch(orderRecorded(summary('o2')));
    await rejecting.settle();
    assert.equal(store.getState().orderHistory.notifications.records.o2?.status, 'failed');
    assert.equal(store.getState().orderHistory.notifications.records.o2?.notified, false);
  });

  it('a retry for an order that is not in the local history schedules nothing and records nothing', async () => {
    const { store, calls, settle } = createHarness();

    store.dispatch(notificationRetryRequested('ghost'));
    await settle();

    assert.equal(calls.length, 0);
    assert.deepEqual(store.getState().orderHistory.notifications.records, {});
  });

  it('RF-39 forwards the reason to the record: a first denial is recoverable, the retry replaces it with its own evaluation', async () => {
    const { store, calls, settle, record } = createHarness({
      outcomes: [
        { kind: 'unusable', canOpenSettings: true, reason: 'denied-recoverable' },
        { kind: 'unusable', canOpenSettings: true, reason: 'blocked' },
      ],
    });

    store.dispatch(orderRecorded(summary('o1')));
    await settle();
    assert.deepEqual(record('o1'), { permissionRequested: true, notified: false, status: 'unusable', canOpenSettings: true, unusableReason: 'denied-recoverable' });

    store.dispatch(notificationRetryRequested('o1'));
    await settle();
    // While the retry runs the old reason is gone (the seen state of the second call).
    assert.deepEqual(calls[1]?.seen, { o1: { permissionRequested: true, notified: false, status: 'scheduling', canOpenSettings: false } });
    assert.deepEqual(record('o1'), { permissionRequested: true, notified: false, status: 'unusable', canOpenSettings: true, unusableReason: 'blocked' });
    assert.deepEqual(calls.map((call) => call.requestPermission), [true, false], 'the same order never asks again (RF-23)');
  });

  it('RF-39 a recoverable order retried after enabling notifications is scheduled, marked and loses its reason', async () => {
    const { store, calls, settle, record } = createHarness({
      outcomes: [{ kind: 'unusable', canOpenSettings: true, reason: 'denied-recoverable' }, SCHEDULED],
    });

    store.dispatch(orderRecorded(summary('o1')));
    await settle();
    store.dispatch(notificationRetryRequested('o1'));
    await settle();

    assert.deepEqual(record('o1'), { permissionRequested: true, notified: true, status: 'scheduled', canOpenSettings: false });
    assert.deepEqual(calls.map((call) => call.requestPermission), [true, false]);
  });

  it('RF-39 a later order gets its own category without changing an earlier one', async () => {
    const { store, settle, record } = createHarness({
      outcomes: [
        { kind: 'unusable', canOpenSettings: true, reason: 'denied-recoverable' },
        { kind: 'unusable', canOpenSettings: true, reason: 'blocked' },
      ],
    });

    store.dispatch(orderRecorded(summary('a')));
    await settle();
    store.dispatch(orderRecorded(summary('b')));
    await settle();

    assert.equal(record('a')?.unusableReason, 'denied-recoverable');
    assert.equal(record('b')?.unusableReason, 'blocked');
  });

  describe('after a restart (a new store and a new listener around the restored history)', () => {
    function persisted(store: ReturnType<typeof createHarness>['store']): unknown {
      // What redux-persist writes and reads back: JSON, nothing else survives.
      return JSON.parse(JSON.stringify(store.getState().orderHistory));
    }

    it('a marked order is neither requested nor scheduled again, even if the idempotent response arrives again', async () => {
      const first = createHarness();
      first.store.dispatch(orderRecorded(summary('o1')));
      await first.settle();

      const second = createHarness({ preloaded: persisted(first.store) });
      second.store.dispatch(orderRecorded(summary('o1')));
      second.store.dispatch(notificationRetryRequested('o1'));
      await second.settle();

      assert.equal(second.calls.length, 0);
      assert.equal(second.record('o1')?.notified, true);
    });

    it('a request recorded before the system answered survives the crash: the retry does not ask again', async () => {
      const never = new Promise<OrderNotificationScheduleResult>(() => undefined);
      const first = createHarness({ outcomes: [never] });
      first.store.dispatch(orderRecorded(summary('o1')));
      await first.settle();
      // The process dies here: the dialog never answered, but the request is already in the state.
      const stored = persisted(first.store);

      const second = createHarness({ preloaded: stored });
      assert.equal(second.record('o1')?.permissionRequested, true);
      assert.equal(second.record('o1')?.status, 'idle', 'a transient "scheduling" is restored as idle');
      second.store.dispatch(notificationRetryRequested('o1'));
      await second.settle();

      assert.deepEqual(second.calls.map((call) => call.requestPermission), [false]);
      assert.equal(second.record('o1')?.notified, true);
    });

    it('a failed schedule survives the restart as retryable and only the success marks it', async () => {
      const first = createHarness({ outcomes: [{ kind: 'failed', error: new Error('x') }] });
      first.store.dispatch(orderRecorded(summary('o1')));
      await first.settle();

      const second = createHarness({ preloaded: persisted(first.store) });
      assert.deepEqual(second.record('o1'), { permissionRequested: true, notified: false, status: 'failed', canOpenSettings: false });
      second.store.dispatch(notificationRetryRequested('o1'));
      await second.settle();
      assert.equal(second.record('o1')?.notified, true);

      const third = createHarness({ preloaded: persisted(second.store) });
      third.store.dispatch(notificationRetryRequested('o1'));
      await third.settle();
      assert.equal(third.calls.length, 0);
    });

    it('RF-39 the reason survives the restart and a retry there replaces it without asking again', async () => {
      const first = createHarness({ outcomes: [{ kind: 'unusable', canOpenSettings: true, reason: 'denied-recoverable' }] });
      first.store.dispatch(orderRecorded(summary('o1')));
      await first.settle();

      const second = createHarness({ preloaded: persisted(first.store), outcomes: [{ kind: 'unusable', canOpenSettings: true, reason: 'blocked' }] });
      assert.equal(second.record('o1')?.unusableReason, 'denied-recoverable', 'the last known category, without asking the system');
      assert.equal(second.calls.length, 0);
      second.store.dispatch(notificationRetryRequested('o1'));
      await second.settle();

      assert.deepEqual(second.calls.map((call) => call.requestPermission), [false]);
      assert.equal(second.record('o1')?.unusableReason, 'blocked');
    });

    it('records for orders that are no longer in the history are dropped when restoring', async () => {
      const first = createHarness();
      first.store.dispatch(orderRecorded(summary('o1')));
      await first.settle();
      const stored = persisted(first.store) as { notifications: { records: Record<string, unknown> } };
      stored.notifications.records.ghost = { permissionRequested: true, notified: true, status: 'scheduled', canOpenSettings: false };

      const second = createHarness({ preloaded: stored });

      assert.deepEqual(Object.keys(second.store.getState().orderHistory.notifications.records), ['o1']);
    });
  });
});

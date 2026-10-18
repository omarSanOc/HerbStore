/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { FLUSH, PAUSE, PERSIST, persistReducer, persistStore, PURGE, REGISTER, REHYDRATE } from 'redux-persist';

import type { OrderSummary } from '../../features/checkout/contracts/order.ts';
import type { OrderNotificationScheduleResult } from '../../features/notifications/logic/order-notification-coordinator.ts';
import { createOrderNotificationListener } from '../../features/notifications/store/create-order-notification-listener.ts';
import {
  notificationRetryRequested,
  orderHistoryReducer,
  orderRecorded,
} from '../../features/orders/store/order-history-slice.ts';
import { createPersistConfig, PERSIST_KEY, PERSIST_VERSION } from './persist-policy.ts';
import { createSafeStorage, type KeyValueBackend } from './persist-storage.ts';

// The REAL redux-persist pipeline (reducer, persistoid, rehydration, `migrate`) over an in-memory
// backend shaped like MMKV, with the real order-history slice and the real notification listener.
// "Restart" = a new store, a new persistor and a new listener over the SAME backend.

const STORAGE_KEY = `persist:${PERSIST_KEY}`;

function summary(id: string): OrderSummary {
  return { id, items: [], currency: 'MXN', subtotal: 0, shipping: 0, total: 0, createdAt: '2026-01-01T00:00:00.000Z' };
}

function memoryBackend(): KeyValueBackend & { readonly values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getString: (key) => values.get(key),
    set: (key, value) => {
      values.set(key, value);
    },
    remove: (key) => values.delete(key),
  };
}

const rootReducer = combineReducers({ orderHistory: orderHistoryReducer });

async function startApp(backend: KeyValueBackend, outcome: () => Promise<OrderNotificationScheduleResult>) {
  const calls: boolean[] = [];
  const listener = createOrderNotificationListener({
    getLanguage: () => 'es',
    schedule: (_language, options) => {
      calls.push(options.requestPermission);
      return outcome();
    },
  });
  const store = configureStore({
    reducer: persistReducer(
      createPersistConfig<ReturnType<typeof rootReducer>>(createSafeStorage(() => backend)),
      rootReducer,
    ),
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: { ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER] },
      }).prepend(listener.middleware),
  });
  const persistor = persistStore(store);
  await new Promise<void>((resolve) => {
    const check = () => {
      if (store.getState()._persist.rehydrated) {
        unsubscribe();
        resolve();
      }
    };
    const unsubscribe = store.subscribe(check);
    check();
  });
  const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
  const record = (id: string) => store.getState().orderHistory.notifications.records[id];
  return { store, persistor, calls, settle, record };
}

const scheduled = () => Promise.resolve<OrderNotificationScheduleResult>({ kind: 'scheduled', identifier: 'n-1' });

function storedOrderHistory(backend: { values: Map<string, string> }): { notifications: { records: Record<string, Record<string, unknown>> } } {
  const raw = backend.values.get(STORAGE_KEY);
  assert.ok(raw, 'something was written');
  const slices = JSON.parse(raw) as Record<string, string>;
  return JSON.parse(slices.orderHistory ?? '{}');
}

describe('order notification marks through the real persistence pipeline', () => {
  it('a restart keeps the marks: the same order is not requested or scheduled again', async () => {
    const backend = memoryBackend();
    const first = await startApp(backend, scheduled);
    first.store.dispatch(orderRecorded(summary('o1')));
    await first.settle();
    await first.persistor.flush();
    assert.deepEqual(first.calls, [true]);
    first.persistor.pause();

    const second = await startApp(backend, scheduled);
    assert.deepEqual(second.record('o1'), { permissionRequested: true, notified: true, status: 'scheduled', canOpenSettings: false });
    second.store.dispatch(orderRecorded(summary('o1')));
    second.store.dispatch(notificationRetryRequested('o1'));
    await second.settle();

    assert.deepEqual(second.calls, []);
    second.persistor.pause();
  });

  it('the access request is already on disk while the system dialog is still open', async () => {
    const backend = memoryBackend();
    const first = await startApp(backend, () => new Promise<OrderNotificationScheduleResult>(() => undefined));

    first.store.dispatch(orderRecorded(summary('o1')));
    await first.settle();
    await first.persistor.flush();

    // The dialog has not been answered (the scheduler never settles) and the constancia is stored.
    const stored = storedOrderHistory(backend).notifications.records.o1;
    assert.equal(stored?.permissionRequested, true);
    assert.equal(stored?.notified, false);
    first.persistor.pause();

    // The process died with the dialog open: after the restart the order must not ask again.
    const second = await startApp(backend, scheduled);
    second.store.dispatch(notificationRetryRequested('o1'));
    await second.settle();

    assert.deepEqual(second.calls, [false]);
    assert.equal(second.record('o1')?.notified, true);
    second.persistor.pause();
  });

  it('a failed schedule is retryable after a restart and only the success marks it on disk', async () => {
    const backend = memoryBackend();
    const first = await startApp(backend, () => Promise.resolve<OrderNotificationScheduleResult>({ kind: 'failed', error: new Error('x') }));
    first.store.dispatch(orderRecorded(summary('o1')));
    await first.settle();
    await first.persistor.flush();
    assert.equal(storedOrderHistory(backend).notifications.records.o1?.notified, false);
    first.persistor.pause();

    const second = await startApp(backend, scheduled);
    second.store.dispatch(notificationRetryRequested('o1'));
    await second.settle();
    await second.persistor.flush();

    assert.deepEqual(second.calls, [false]);
    assert.equal(storedOrderHistory(backend).notifications.records.o1?.notified, true);
    second.persistor.pause();
  });

  it('a record for an order that is not in the stored history is dropped on restore', async () => {
    const backend = memoryBackend();
    const first = await startApp(backend, scheduled);
    first.store.dispatch(orderRecorded(summary('o1')));
    await first.settle();
    await first.persistor.flush();
    first.persistor.pause();

    const slices = JSON.parse(backend.values.get(STORAGE_KEY) ?? '{}') as Record<string, string>;
    const history = JSON.parse(slices.orderHistory ?? '{}') as { notifications: { records: Record<string, unknown> } };
    history.notifications.records.ghost = { permissionRequested: true, notified: true, status: 'scheduled', canOpenSettings: false };
    backend.values.set(STORAGE_KEY, JSON.stringify({ ...slices, orderHistory: JSON.stringify(history) }));

    const second = await startApp(backend, scheduled);

    assert.deepEqual(Object.keys(second.store.getState().orderHistory.notifications.records), ['o1']);
    second.persistor.pause();
  });

  it('RF-39 the reason reaches the disk, survives a restart and a retry there replaces it without asking again', async () => {
    const backend = memoryBackend();
    const first = await startApp(backend, () => Promise.resolve<OrderNotificationScheduleResult>({ kind: 'unusable', canOpenSettings: true, reason: 'denied-recoverable' }));
    first.store.dispatch(orderRecorded(summary('o1')));
    await first.settle();
    await first.persistor.flush();
    assert.equal(storedOrderHistory(backend).notifications.records.o1?.unusableReason, 'denied-recoverable');
    assert.equal((JSON.parse(JSON.parse(backend.values.get(STORAGE_KEY) ?? '{}')._persist) as { version: number }).version, PERSIST_VERSION);
    first.persistor.pause();

    const second = await startApp(backend, () => Promise.resolve<OrderNotificationScheduleResult>({ kind: 'unusable', canOpenSettings: true, reason: 'blocked' }));
    assert.equal(second.record('o1')?.unusableReason, 'denied-recoverable');
    second.store.dispatch(notificationRetryRequested('o1'));
    await second.settle();
    await second.persistor.flush();

    assert.deepEqual(second.calls, [false], 'the retry never requests access again (RF-23)');
    assert.equal(storedOrderHistory(backend).notifications.records.o1?.unusableReason, 'blocked');
    second.persistor.pause();
  });

  it('a v2 state on disk (the T8 build) upgrades to v3: cart and orders kept, the unusable order shows blocked', async () => {
    const backend = memoryBackend();
    const order = summary('o1');
    // Exactly what redux-persist 6 wrote with version 2: every slice is its own JSON string.
    backend.values.set(STORAGE_KEY, JSON.stringify({
      orderHistory: JSON.stringify({
        orders: [order],
        notifications: { records: { o1: { permissionRequested: true, notified: false, status: 'unusable', canOpenSettings: true } } },
      }),
      _persist: JSON.stringify({ version: 2, rehydrated: true }),
    }));

    const app = await startApp(backend, scheduled);

    assert.deepEqual(app.store.getState().orderHistory.orders, [order]);
    assert.deepEqual(app.record('o1'), { permissionRequested: true, notified: false, status: 'unusable', canOpenSettings: true, unusableReason: 'blocked' });
    await app.persistor.flush();
    assert.equal(storedOrderHistory(backend).notifications.records.o1?.unusableReason, 'blocked');
    app.persistor.pause();
  });

  it('clearing the storage (clear data / uninstall) forgets the marks, so the order can be requested again', async () => {
    const backend = memoryBackend();
    const first = await startApp(backend, scheduled);
    first.store.dispatch(orderRecorded(summary('o1')));
    await first.settle();
    await first.persistor.flush();
    first.persistor.pause();

    backend.values.clear();
    const second = await startApp(backend, scheduled);
    assert.deepEqual(second.store.getState().orderHistory, { orders: [], notifications: { records: {} } });
    second.store.dispatch(orderRecorded(summary('o1')));
    await second.settle();

    assert.deepEqual(second.calls, [true]);
    second.persistor.pause();
  });
});

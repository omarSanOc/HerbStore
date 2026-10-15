import assert from 'node:assert/strict';
import test from 'node:test';

import { createOrderNotificationCoordinator } from './order-notification-coordinator.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

test('concurrent orderRecorded effects for one order share one scheduling operation', async () => {
  const pending = deferred<{ kind: 'scheduled'; identifier: string }>();
  let schedules = 0;
  const coordinator = createOrderNotificationCoordinator();
  const input = {
    orderId: 'order-1',
    permissionRequested: false,
    notified: false,
    schedule: () => { schedules += 1; return pending.promise; },
    onPermissionRequested: () => undefined,
    onScheduling: () => undefined,
    onScheduled: () => undefined,
    onUnusable: () => undefined,
    onFailed: () => undefined,
  } as const;

  const first = coordinator.run(input);
  const second = coordinator.run(input);
  assert.equal(schedules, 0, 'the injected scheduler starts in the queued task');
  pending.resolve({ kind: 'scheduled', identifier: 'notification-1' });
  assert.deepEqual(await Promise.all([first, second]), ['scheduled', 'scheduled']);
  assert.equal(schedules, 1);
});

test('cleanup after failure permits an explicit retry without requesting permission again', async () => {
  const requestFlags: boolean[] = [];
  const outcomes = [
    { kind: 'failed', error: new Error('first') } as const,
    { kind: 'scheduled', identifier: 'notification-2' } as const,
  ];
  const coordinator = createOrderNotificationCoordinator();
  const callbacks = {
    onPermissionRequested: () => undefined,
    onScheduling: () => undefined,
    onScheduled: () => undefined,
    onUnusable: () => undefined,
    onFailed: () => undefined,
  };

  const first = await coordinator.run({
    ...callbacks,
    orderId: 'order-1',
    permissionRequested: false,
    notified: false,
    schedule: (options) => { requestFlags.push(options.requestPermission); return Promise.resolve(outcomes.shift()!); },
  });
  const retry = await coordinator.run({
    ...callbacks,
    orderId: 'order-1',
    permissionRequested: true,
    notified: false,
    schedule: (options) => { requestFlags.push(options.requestPermission); return Promise.resolve(outcomes.shift()!); },
  });

  assert.equal(first, 'failed');
  assert.equal(retry, 'scheduled');
  assert.deepEqual(requestFlags, [true, false]);
});

test('RF-39 an unusable result forwards its Settings hint and reason without deciding anything', async () => {
  const unusable: [boolean, string][] = [];
  const coordinator = createOrderNotificationCoordinator();
  const callbacks = {
    onPermissionRequested: () => undefined,
    onScheduling: () => undefined,
    onScheduled: () => undefined,
    onUnusable: (canOpenSettings: boolean, reason: 'denied-recoverable' | 'blocked') => { unusable.push([canOpenSettings, reason]); },
    onFailed: () => undefined,
  };

  for (const reason of ['denied-recoverable', 'blocked'] as const) {
    const result = await coordinator.run({
      ...callbacks,
      orderId: `order-${reason}`,
      permissionRequested: false,
      notified: false,
      schedule: () => Promise.resolve({ kind: 'unusable', canOpenSettings: true, reason }),
    });
    assert.equal(result, 'unusable');
  }

  assert.deepEqual(unusable, [[true, 'denied-recoverable'], [true, 'blocked']]);
});

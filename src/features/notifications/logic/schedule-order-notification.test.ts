import assert from 'node:assert/strict';
import test from 'node:test';

import type { ExpoPermissionResponse as PermissionResponse } from './notification-permission.ts';
import { scheduleOrderNotification, type OrderNotificationPort } from './schedule-order-notification.ts';

const FRESH_ANDROID_13: PermissionResponse = { status: 'denied', granted: false, canAskAgain: true };
const GRANTED_ANDROID: PermissionResponse = { status: 'granted', granted: true, canAskAgain: true };
const FIRST_DENIAL_ANDROID_13: PermissionResponse = { status: 'denied', granted: false, canAskAgain: true };
const BLOCKED_ANDROID_13: PermissionResponse = { status: 'denied', granted: false, canAskAgain: false };

/** A scripted port that records the order of every call: the sequence is part of the contract. */
function createPort(script: {
  current: PermissionResponse;
  afterRequest?: PermissionResponse;
  scheduleError?: unknown;
  channelError?: unknown;
  permissionsError?: unknown;
}) {
  const calls: string[] = [];
  const scheduled: Readonly<{ title: string; body: string; data: unknown }>[] = [];
  const channels: string[] = [];
  const port: OrderNotificationPort = {
    ensureChannel: async (name) => {
      calls.push('channel');
      channels.push(name);
      if (script.channelError) throw script.channelError;
    },
    getPermissions: async () => {
      calls.push('get');
      if (script.permissionsError) throw script.permissionsError;
      return script.current;
    },
    requestPermissions: async () => {
      calls.push('request');
      return script.afterRequest ?? script.current;
    },
    schedule: async (content) => {
      calls.push('schedule');
      if (script.scheduleError) throw script.scheduleError;
      scheduled.push(content);
      return 'notification-id';
    },
  };
  return { port, calls, scheduled, channels };
}

const android13 = { platform: 'android', apiLevel: 33 } as const;
const android12 = { platform: 'android', apiLevel: 32 } as const;
const ios = { platform: 'ios' } as const;

test('Android creates the channel BEFORE it reads or requests the permission, then asks once and schedules', async () => {
  const { port, calls, scheduled, channels } = createPort({ current: FRESH_ANDROID_13, afterRequest: GRANTED_ANDROID });

  const result = await scheduleOrderNotification({ port, env: android13, language: 'es', requestPermission: true });

  assert.deepEqual(result, { kind: 'scheduled', identifier: 'notification-id' });
  assert.deepEqual(calls, ['channel', 'get', 'request', 'schedule']);
  assert.deepEqual(channels, ['Pedidos'], 'the channel name is localized in the active language');
  assert.equal(scheduled.length, 1);
});

test('the immediate content is localized, closed and carries no order id or address', async () => {
  for (const language of ['es', 'en'] as const) {
    const { port, scheduled } = createPort({ current: GRANTED_ANDROID });
    await scheduleOrderNotification({ port, env: android13, language, requestPermission: true });
    const [content] = scheduled;
    assert.deepEqual(Object.keys(content ?? {}).sort(), ['body', 'data', 'title']);
    assert.deepEqual(content?.data, { destination: 'home' });
    assert.equal(content?.title, language === 'es' ? 'Pedido confirmado' : 'Order confirmed');
  }
});

test('an order that already used its request never asks again: unusable with Settings, nothing scheduled', async () => {
  const { port, calls, scheduled } = createPort({ current: FRESH_ANDROID_13 });

  const result = await scheduleOrderNotification({ port, env: android13, language: 'es', requestPermission: false });

  assert.deepEqual(result, { kind: 'unusable', canOpenSettings: true, reason: 'denied-recoverable' });
  assert.deepEqual(calls, ['channel', 'get']);
  assert.equal(scheduled.length, 0);
});

test('a first denial leaves the order unusable with Settings and does not schedule', async () => {
  const { port, calls, scheduled } = createPort({ current: FRESH_ANDROID_13, afterRequest: FIRST_DENIAL_ANDROID_13 });

  const result = await scheduleOrderNotification({ port, env: android13, language: 'en', requestPermission: true });

  assert.deepEqual(result, { kind: 'unusable', canOpenSettings: true, reason: 'denied-recoverable' });
  assert.deepEqual(calls, ['channel', 'get', 'request']);
  assert.equal(scheduled.length, 0);
});

test('a permission the system already blocked is never requested, even when the order has no request yet', async () => {
  const { port, calls } = createPort({ current: BLOCKED_ANDROID_13 });

  const result = await scheduleOrderNotification({ port, env: android13, language: 'es', requestPermission: true });

  assert.deepEqual(result, { kind: 'unusable', canOpenSettings: true, reason: 'blocked' });
  assert.deepEqual(calls, ['channel', 'get']);
});

test('Android without the runtime dialog continues when the system allows notifying and never asks', async () => {
  const usable = createPort({ current: GRANTED_ANDROID });
  assert.equal((await scheduleOrderNotification({ port: usable.port, env: android12, language: 'es', requestPermission: true })).kind, 'scheduled');
  assert.deepEqual(usable.calls, ['channel', 'get', 'schedule']);

  const disabled = createPort({ current: { status: 'denied', granted: false, canAskAgain: false } });
  assert.deepEqual(await scheduleOrderNotification({ port: disabled.port, env: android12, language: 'es', requestPermission: true }), { kind: 'unusable', canOpenSettings: true, reason: 'blocked' });
  assert.deepEqual(disabled.calls, ['channel', 'get']);
});

test('iOS skips the channel, treats provisional as usable and asks only from notDetermined', async () => {
  const provisional = createPort({ current: { status: 'undetermined', canAskAgain: true, ios: { status: 3 } } });
  assert.equal((await scheduleOrderNotification({ port: provisional.port, env: ios, language: 'es', requestPermission: true })).kind, 'scheduled');
  assert.deepEqual(provisional.calls, ['get', 'schedule']);

  const fresh = createPort({ current: { status: 'undetermined', canAskAgain: true, ios: { status: 0 } }, afterRequest: { status: 'granted', canAskAgain: true, ios: { status: 2 } } });
  assert.equal((await scheduleOrderNotification({ port: fresh.port, env: ios, language: 'es', requestPermission: true })).kind, 'scheduled');
  assert.deepEqual(fresh.calls, ['get', 'request', 'schedule']);

  const denied = createPort({ current: { status: 'denied', canAskAgain: false, ios: { status: 1 } } });
  assert.deepEqual(await scheduleOrderNotification({ port: denied.port, env: ios, language: 'es', requestPermission: true }), { kind: 'unusable', canOpenSettings: true, reason: 'blocked' });
  assert.deepEqual(denied.calls, ['get']);
});

test('a scheduling failure is a discriminated result, never a throw', async () => {
  const boom = new Error('native scheduler refused');
  const { port, calls } = createPort({ current: GRANTED_ANDROID, scheduleError: boom });

  const result = await scheduleOrderNotification({ port, env: android13, language: 'es', requestPermission: true });

  assert.deepEqual(result, { kind: 'failed', error: boom });
  assert.deepEqual(calls, ['channel', 'get', 'schedule']);
});

test('failures reading the permission or creating the channel are failed results too', async () => {
  const permissions = createPort({ current: GRANTED_ANDROID, permissionsError: new Error('no module') });
  assert.equal((await scheduleOrderNotification({ port: permissions.port, env: android13, language: 'es', requestPermission: true })).kind, 'failed');

  const channel = createPort({ current: GRANTED_ANDROID, channelError: new Error('no channel') });
  const result = await scheduleOrderNotification({ port: channel.port, env: android13, language: 'es', requestPermission: true });
  assert.equal(result.kind, 'failed');
  assert.deepEqual(channel.calls, ['channel'], 'nothing else runs after the channel failed');
});

// ---------------------------------------------------------------------------------------------
// RF-39: the reason comes from the LAST reading of this evaluation, and the order never asks twice.
// ---------------------------------------------------------------------------------------------

test('RF-39 order A: first denial is recoverable; its retry never requests and re-reads the same reason', async () => {
  const first = createPort({ current: FRESH_ANDROID_13, afterRequest: FIRST_DENIAL_ANDROID_13 });
  assert.deepEqual(
    await scheduleOrderNotification({ port: first.port, env: android13, language: 'es', requestPermission: true }),
    { kind: 'unusable', canOpenSettings: true, reason: 'denied-recoverable' },
  );
  assert.deepEqual(first.calls, ['channel', 'get', 'request']);

  // Retry of the same order (its request is on record): only `getPermissions` decides.
  const retry = createPort({ current: FIRST_DENIAL_ANDROID_13, afterRequest: GRANTED_ANDROID });
  assert.deepEqual(
    await scheduleOrderNotification({ port: retry.port, env: android13, language: 'en', requestPermission: false }),
    { kind: 'unusable', canOpenSettings: true, reason: 'denied-recoverable' },
  );
  assert.deepEqual(retry.calls, ['channel', 'get'], 'requestPermissions is never called on a retry');
});

test('RF-39 order B: the second denial (the system stops showing the dialog) is blocked', async () => {
  const { port, calls } = createPort({ current: FIRST_DENIAL_ANDROID_13, afterRequest: BLOCKED_ANDROID_13 });

  const result = await scheduleOrderNotification({ port, env: android13, language: 'es', requestPermission: true });

  assert.deepEqual(result, { kind: 'unusable', canOpenSettings: true, reason: 'blocked' });
  assert.deepEqual(calls, ['channel', 'get', 'request']);
});

test('RF-39 a retry of a recoverable order after the system blocked the dialog re-evaluates to blocked', async () => {
  const { port, calls } = createPort({ current: BLOCKED_ANDROID_13 });

  const result = await scheduleOrderNotification({ port, env: android13, language: 'es', requestPermission: false });

  assert.deepEqual(result, { kind: 'unusable', canOpenSettings: true, reason: 'blocked' });
  assert.deepEqual(calls, ['channel', 'get']);
});

test('RF-39 a retry after enabling notifications in Settings schedules (no reason, no request)', async () => {
  const { port, calls } = createPort({ current: GRANTED_ANDROID });

  const result = await scheduleOrderNotification({ port, env: android13, language: 'es', requestPermission: false });

  assert.deepEqual(result, { kind: 'scheduled', identifier: 'notification-id' });
  assert.deepEqual(calls, ['channel', 'get', 'schedule']);
});

test('RF-39 iOS: rejecting the dialog is blocked, and notDetermined whose request was used is blocked too', async () => {
  const rejected = createPort({ current: { status: 'undetermined', canAskAgain: true, ios: { status: 0 } }, afterRequest: { status: 'denied', canAskAgain: false, ios: { status: 1 } } });
  assert.deepEqual(
    await scheduleOrderNotification({ port: rejected.port, env: ios, language: 'es', requestPermission: true }),
    { kind: 'unusable', canOpenSettings: true, reason: 'blocked' },
  );
  assert.deepEqual(rejected.calls, ['get', 'request']);

  const used = createPort({ current: { status: 'undetermined', canAskAgain: true, ios: { status: 0 } } });
  assert.deepEqual(
    await scheduleOrderNotification({ port: used.port, env: ios, language: 'es', requestPermission: false }),
    { kind: 'unusable', canOpenSettings: true, reason: 'blocked' },
  );
  assert.deepEqual(used.calls, ['get']);
});

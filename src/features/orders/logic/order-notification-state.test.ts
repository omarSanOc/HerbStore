import assert from 'node:assert/strict';
import test from 'node:test';
import {
  emptyOrderNotificationState,
  markNotificationFailed,
  markNotificationScheduled,
  markNotificationScheduling,
  markNotificationUnusable,
  markPermissionRequested,
  sanitizeOrderNotificationState,
} from './order-notification-state.ts';

test('records permission before scheduling and marks only success', () => {
  const requested = markPermissionRequested(emptyOrderNotificationState, 'o1');
  assert.equal(requested.records.o1?.permissionRequested, true);
  assert.equal(requested.records.o1?.notified, false);
  assert.equal(markNotificationScheduled(requested, 'o1').records.o1?.notified, true);
});

test('sanitizes records against local order history and malformed values', () => {
  const clean = sanitizeOrderNotificationState({ records: { o1: { permissionRequested: true, notified: true }, ghost: { permissionRequested: true, notified: true }, bad: null } }, ['o1']);
  assert.deepEqual(Object.keys(clean.records), ['o1']);
});

test('keeps a faithful observable unusable or failed result and clears transient scheduling on restore', () => {
  const requested = markPermissionRequested(emptyOrderNotificationState, 'o1');
  const scheduling = markNotificationScheduling(requested, 'o1');
  assert.equal(scheduling.records.o1?.status, 'scheduling');

  const unusable = markNotificationUnusable(scheduling, 'o1', true, 'blocked');
  assert.deepEqual(unusable.records.o1, {
    permissionRequested: true,
    notified: false,
    status: 'unusable',
    canOpenSettings: true,
    unusableReason: 'blocked',
  });
  assert.equal(markNotificationFailed(unusable, 'o1').records.o1?.status, 'failed');

  const restored = sanitizeOrderNotificationState({ records: { o1: scheduling.records.o1 } }, ['o1']);
  assert.equal(restored.records.o1?.status, 'idle');
});

// RF-39: the reason is the last evaluation of THIS order. Only `unusable` carries it; every other
// transition removes it, so a retry always shows its own new evaluation.

test('RF-39 unusable stores the reason of the evaluation, for each order on its own', () => {
  const a = markNotificationUnusable(markPermissionRequested(emptyOrderNotificationState, 'a'), 'a', true, 'denied-recoverable');
  const both = markNotificationUnusable(markPermissionRequested(a, 'b'), 'b', true, 'blocked');

  assert.equal(both.records.a?.unusableReason, 'denied-recoverable');
  assert.equal(both.records.b?.unusableReason, 'blocked');
  assert.equal(both.records.a?.permissionRequested, true, 'the request on record is kept');
});

test('RF-39 scheduling, scheduled and failed remove the reason (the key itself, not only its value)', () => {
  const unusable = markNotificationUnusable(markPermissionRequested(emptyOrderNotificationState, 'o1'), 'o1', true, 'denied-recoverable');

  for (const [label, next] of [
    ['scheduling', markNotificationScheduling(unusable, 'o1')],
    ['scheduled', markNotificationScheduled(unusable, 'o1')],
    ['failed', markNotificationFailed(unusable, 'o1')],
  ] as const) {
    assert.equal(Object.hasOwn(next.records.o1 ?? {}, 'unusableReason'), false, label);
    assert.equal(next.records.o1?.permissionRequested, true, `${label} keeps the request on record`);
  }
});

test('RF-39 a retry replaces the reason: recoverable → scheduling → blocked, never both', () => {
  const first = markNotificationUnusable(markPermissionRequested(emptyOrderNotificationState, 'o1'), 'o1', true, 'denied-recoverable');
  const retrying = markNotificationScheduling(first, 'o1');
  const second = markNotificationUnusable(retrying, 'o1', true, 'blocked');

  assert.deepEqual(second.records.o1, { permissionRequested: true, notified: false, status: 'unusable', canOpenSettings: true, unusableReason: 'blocked' });
});

test('RF-39 transitions never mutate the previous state', () => {
  const before = markNotificationUnusable(markPermissionRequested(emptyOrderNotificationState, 'o1'), 'o1', true, 'denied-recoverable');
  const snapshot = structuredClone(before);
  markNotificationScheduling(before, 'o1');
  markNotificationUnusable(before, 'o1', true, 'blocked');
  assert.deepEqual(before, snapshot);
});

test('RF-39 sanitize keeps a valid reason only on unusable records', () => {
  const restored = sanitizeOrderNotificationState({
    records: {
      recoverable: { permissionRequested: true, notified: false, status: 'unusable', canOpenSettings: true, unusableReason: 'denied-recoverable' },
      blocked: { permissionRequested: true, notified: false, status: 'unusable', canOpenSettings: true, unusableReason: 'blocked' },
      failed: { permissionRequested: true, notified: false, status: 'failed', canOpenSettings: false, unusableReason: 'denied-recoverable' },
      notified: { permissionRequested: true, notified: true, status: 'unusable', canOpenSettings: true, unusableReason: 'blocked' },
    },
  }, ['recoverable', 'blocked', 'failed', 'notified']);

  assert.equal(restored.records.recoverable?.unusableReason, 'denied-recoverable');
  assert.equal(restored.records.blocked?.unusableReason, 'blocked');
  assert.equal(Object.hasOwn(restored.records.failed ?? {}, 'unusableReason'), false, 'a non-unusable record drops it');
  assert.equal(restored.records.notified?.status, 'scheduled');
  assert.equal(Object.hasOwn(restored.records.notified ?? {}, 'unusableReason'), false);
});

test('RF-39 sanitize: an unusable record with a missing or invalid reason counts as blocked', () => {
  for (const [label, reason] of [
    ['missing (a v2 record)', undefined],
    ['unknown text', 'maybe'],
    ['wrong case', 'Blocked'],
    ['a number', 1],
    ['null', null],
    ['an object', { reason: 'denied-recoverable' }],
  ] as const) {
    const item: Record<string, unknown> = { permissionRequested: true, notified: false, status: 'unusable', canOpenSettings: true };
    if (reason !== undefined) item.unusableReason = reason;
    const restored = sanitizeOrderNotificationState({ records: { o1: item } }, ['o1']);
    assert.deepEqual(restored.records.o1, { permissionRequested: true, notified: false, status: 'unusable', canOpenSettings: true, unusableReason: 'blocked' }, label);
  }
});

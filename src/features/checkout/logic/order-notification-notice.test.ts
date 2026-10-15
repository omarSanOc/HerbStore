/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';

import { en } from '../../../core/i18n/resources/en.ts';
import { es } from '../../../core/i18n/resources/es.ts';
import type { OrderNotificationRecord } from '../../orders/logic/order-notification-state.ts';
import { buildNotificationNotice, type NotificationNotice } from './order-notification-notice.ts';

const record = (overrides: Partial<OrderNotificationRecord> = {}): OrderNotificationRecord => ({
  permissionRequested: true,
  notified: false,
  status: 'idle',
  canOpenSettings: false,
  ...overrides,
});

const unusable = (reason: OrderNotificationRecord['unusableReason']) =>
  record({ status: 'unusable', canOpenSettings: true, unusableReason: reason });

const actionsOf = (notice: NotificationNotice | null) =>
  notice ? { showSettings: notice.showSettings, showRetry: notice.showRetry, retrying: notice.retrying } : null;

test('denied-recoverable shows its own text with Settings and retry', () => {
  assert.deepEqual(buildNotificationNotice(unusable('denied-recoverable')), {
    messageKey: 'checkout.confirmation.notificationDeniedRecoverable',
    showSettings: true,
    showRetry: true,
    retrying: false,
  });
});

test('blocked keeps the current "blocked" text with Settings and retry', () => {
  assert.deepEqual(buildNotificationNotice(unusable('blocked')), {
    messageKey: 'checkout.confirmation.notificationUnavailableSettings',
    showSettings: true,
    showRetry: true,
    retrying: false,
  });
});

test('both unusable categories offer exactly the same actions; only the text changes (RF-39)', () => {
  const recoverable = buildNotificationNotice(unusable('denied-recoverable'));
  const blocked = buildNotificationNotice(unusable('blocked'));
  assert.deepEqual(actionsOf(recoverable), actionsOf(blocked));
  assert.notEqual(recoverable?.messageKey, blocked?.messageKey);
});

test('an unusable record without a reason falls back to the conservative "blocked" text', () => {
  assert.equal(buildNotificationNotice(unusable(undefined))?.messageKey, 'checkout.confirmation.notificationUnavailableSettings');
});

test('the unusable notice does not depend on canOpenSettings: RF-39 always offers Settings', () => {
  const notice = buildNotificationNotice(record({ status: 'unusable', canOpenSettings: false, unusableReason: 'denied-recoverable' }));
  assert.deepEqual(actionsOf(notice), { showSettings: true, showRetry: true, retrying: false });
});

test('failed offers retry but no Settings', () => {
  assert.deepEqual(buildNotificationNotice(record({ status: 'failed' })), {
    messageKey: 'checkout.confirmation.notificationFailed',
    showSettings: false,
    showRetry: true,
    retrying: false,
  });
});

test('scheduling shows the retry button disabled (busy)', () => {
  assert.deepEqual(buildNotificationNotice(record({ status: 'scheduling' })), {
    messageKey: 'checkout.confirmation.notificationRetrying',
    showSettings: false,
    showRetry: true,
    retrying: true,
  });
});

test('no record or an idle record shows the pending text with retry', () => {
  const pending: NotificationNotice = {
    messageKey: 'checkout.confirmation.notificationPending',
    showSettings: false,
    showRetry: true,
    retrying: false,
  };
  assert.deepEqual(buildNotificationNotice(undefined), pending);
  assert.deepEqual(buildNotificationNotice(record({ status: 'idle', permissionRequested: false })), pending);
});

test('a notified order has no notice at all', () => {
  assert.equal(buildNotificationNotice(record({ notified: true, status: 'scheduled' })), null);
});

test('the notice never asks for permission again: it has no "request" action (RF-23)', () => {
  const notice = buildNotificationNotice(unusable('denied-recoverable'));
  assert.deepEqual(Object.keys(notice ?? {}).sort(), ['messageKey', 'retrying', 'showRetry', 'showSettings']);
});

test('every message key exists in Spanish and English', () => {
  const records: (OrderNotificationRecord | undefined)[] = [
    undefined,
    record(),
    record({ status: 'scheduling' }),
    record({ status: 'failed' }),
    unusable('denied-recoverable'),
    unusable('blocked'),
  ];
  for (const item of records) {
    const key = buildNotificationNotice(item)?.messageKey;
    assert.ok(key);
    const leaf = key.replace('checkout.confirmation.', '') as keyof typeof es.translation.checkout.confirmation;
    assert.equal(typeof es.translation.checkout.confirmation[leaf], 'string', `es: ${key}`);
    assert.equal(typeof en.translation.checkout.confirmation[leaf], 'string', `en: ${key}`);
  }
});

test('approved copy of RF-39 is exact in Spanish and English', () => {
  assert.equal(
    es.translation.checkout.confirmation.notificationDeniedRecoverable,
    'No permitiste las notificaciones para este pedido. Puedes habilitarlas en Ajustes; podremos volver a preguntarte en tu próximo pedido.',
  );
  assert.equal(
    en.translation.checkout.confirmation.notificationDeniedRecoverable,
    "You didn't allow notifications for this order. You can enable them in Settings; we may ask again on your next order.",
  );
});

test('the "blocked" copy is unchanged', () => {
  assert.equal(
    es.translation.checkout.confirmation.notificationUnavailableSettings,
    'Las notificaciones están bloqueadas. Puedes habilitarlas en Ajustes.',
  );
  assert.equal(
    en.translation.checkout.confirmation.notificationUnavailableSettings,
    'Notifications are blocked. You can enable them in Settings.',
  );
});

test('the recoverable text never claims notifications are blocked', () => {
  assert.doesNotMatch(es.translation.checkout.confirmation.notificationDeniedRecoverable, /bloquead/i);
  assert.doesNotMatch(en.translation.checkout.confirmation.notificationDeniedRecoverable, /blocked/i);
});

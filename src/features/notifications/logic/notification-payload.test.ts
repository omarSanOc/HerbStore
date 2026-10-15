import assert from 'node:assert/strict';
import test from 'node:test';
import { en } from '../../../core/i18n/resources/en.ts';
import { es } from '../../../core/i18n/resources/es.ts';
import { buildNotificationContent, isHomeNotificationPayload, notificationChannelName } from './notification-payload.ts';

test('content is localized and contains no order or address data', () => {
  const content = buildNotificationContent('es');
  assert.equal(content.title, 'Pedido confirmado');
  assert.equal(content.body, 'Tu compra se completó.');
  assert.deepEqual(content.data, { destination: 'home' });
  assert.equal(JSON.stringify(content).includes('order'), false);
});

test('only the closed home payload is accepted', () => {
  assert.equal(isHomeNotificationPayload({ destination: 'home' }), true);
  assert.equal(isHomeNotificationPayload({ destination: 'home', orderId: 'secret' }), false);
});

test('the English content has the same closed shape and no order or address data', () => {
  const content = buildNotificationContent('en');
  assert.deepEqual(Object.keys(content).sort(), ['body', 'data', 'title']);
  assert.equal(content.title, 'Order confirmed');
  assert.equal(content.body, 'Your purchase was completed.');
  assert.deepEqual(content.data, { destination: 'home' });
  assert.equal(/\d/.test(JSON.stringify(content)), false, 'no id, number or address fragment');
});

test('title, body and channel name come from the i18n resources, so parity.test.ts guards both languages', () => {
  assert.equal(buildNotificationContent('es').title, es.translation.notifications.orderConfirmed.title);
  assert.equal(buildNotificationContent('es').body, es.translation.notifications.orderConfirmed.body);
  assert.equal(buildNotificationContent('en').title, en.translation.notifications.orderConfirmed.title);
  assert.equal(buildNotificationContent('en').body, en.translation.notifications.orderConfirmed.body);
  assert.equal(notificationChannelName('es'), es.translation.notifications.channelName);
  assert.equal(notificationChannelName('en'), en.translation.notifications.channelName);
  assert.notEqual(notificationChannelName('es'), notificationChannelName('en'));
});

test('the closed payload rejects anything that is not exactly { destination: "home" }', () => {
  for (const value of [null, undefined, 'home', 7, [], {}, { destination: 'cart' }, { destination: 'home', url: 'herbstore://scanner' }]) {
    assert.equal(isHomeNotificationPayload(value), false, JSON.stringify(value));
  }
});

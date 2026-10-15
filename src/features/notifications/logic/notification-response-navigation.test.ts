import assert from 'node:assert/strict';
import test from 'node:test';

import { createNotificationResponseDeduplicator } from './notification-response-navigation.ts';

test('cold and active valid responses navigate once each and consume a closed payload', () => {
  const deduplicator = createNotificationResponseDeduplicator();

  assert.equal(deduplicator.consume({ identifier: 'cold', data: { destination: 'home' } }), 'navigate');
  assert.equal(deduplicator.consume({ identifier: 'active', data: { destination: 'home' } }), 'navigate');
  assert.equal(deduplicator.consume({ identifier: 'invalid', data: { destination: 'home', orderId: 'secret' } }), 'ignored');
});

test('the same response is deduplicated between initial read, active listener and remount', () => {
  const deduplicator = createNotificationResponseDeduplicator();
  const response = { identifier: 'same-request', data: { destination: 'home' } } as const;

  assert.equal(deduplicator.consume(response), 'navigate');
  assert.equal(deduplicator.consume(response), 'duplicate');
  assert.equal(deduplicator.consume(response), 'duplicate');
});

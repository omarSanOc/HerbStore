/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEV_SHIPPING_ADDRESS,
  MAX_DEV_REPOSTS,
  buildDevOrderRequest,
  createDevIdempotencyKey,
  devRetryDelayMs,
  nextDevOrderStep,
} from './dev-order.ts';

describe('createDevIdempotencyKey', () => {
  it('is stable for the same input and different for different inputs', () => {
    const key = createDevIdempotencyKey(1_760_000_000_000, 0.123456);

    assert.equal(createDevIdempotencyKey(1_760_000_000_000, 0.123456), key);
    assert.notEqual(createDevIdempotencyKey(1_760_000_000_001, 0.123456), key);
    assert.notEqual(createDevIdempotencyKey(1_760_000_000_000, 0.654321), key);
  });

  it('is a non-empty token without whitespace (the server trims the header)', () => {
    for (const random of [0, 0.5, 0.999999999999]) {
      const key = createDevIdempotencyKey(1_760_000_000_000, random);

      assert.match(key, /^dev-[0-9a-z]+-[0-9a-z]{8}$/);
    }
  });

  it('clamps a random value outside [0, 1) instead of producing a malformed key', () => {
    for (const random of [-1, 1, 7, Number.NaN]) {
      assert.match(createDevIdempotencyKey(1_760_000_000_000, random), /^dev-[0-9a-z]+-[0-9a-z]{8}$/);
    }
  });
});

describe('buildDevOrderRequest', () => {
  it('has only items, currency and the fictitious address', () => {
    const request = buildDevOrderRequest('product-261009-002', 'USD');

    assert.deepEqual(Object.keys(request).sort(), ['currency', 'items', 'shippingAddress']);
    assert.deepEqual(request.items, [{ productId: 'product-261009-002', quantity: 1 }]);
    assert.equal(request.currency, 'USD');
    assert.deepEqual(request.shippingAddress, DEV_SHIPPING_ADDRESS);
  });

  it('is deterministic: the same product and currency give the same body (a re-POST repeats it)', () => {
    assert.deepEqual(
      buildDevOrderRequest('product-261009-002', 'MXN'),
      buildDevOrderRequest('product-261009-002', 'MXN'),
    );
  });

  it('fits the mock contract: 10-digit phone, 5-digit postal code and no unknown fields', () => {
    const address = DEV_SHIPPING_ADDRESS;

    assert.match(address.phone, /^\d{10}$/);
    assert.match(address.postalCode, /^\d{5}$/);
    assert.ok(address.fullName.length >= 3 && address.state.length >= 2);
    assert.ok(address.city.length >= 2 && address.street.length >= 3);
    assert.deepEqual(Object.keys(address).sort(), [
      'city',
      'exteriorNumber',
      'fullName',
      'phone',
      'postalCode',
      'state',
      'street',
    ]);
  });

  it('uses an obviously fictitious address', () => {
    const text = Object.values(DEV_SHIPPING_ADDRESS).join(' ').toLowerCase();

    assert.match(text, /test/);
    assert.match(DEV_SHIPPING_ADDRESS.phone, /^0+$/);
  });
});

describe('nextDevOrderStep', () => {
  it('stops with success on a confirmed order', () => {
    assert.deepEqual(nextDevOrderStep({ status: 'confirmed', orderId: 'o1' }, 0), { kind: 'done' });
  });

  it('asks to repeat the SAME request after retryAfterSeconds while pending', () => {
    assert.deepEqual(nextDevOrderStep({ status: 'pending', retryAfterSeconds: 2 }, 0), {
      kind: 'repost',
      delayMs: 2_000,
    });
  });

  it('allows exactly MAX_DEV_REPOSTS re-POSTs and then gives up', () => {
    const pending = { status: 'pending', retryAfterSeconds: 1 } as const;

    assert.equal(MAX_DEV_REPOSTS, 3);
    assert.equal(nextDevOrderStep(pending, MAX_DEV_REPOSTS - 1).kind, 'repost');
    assert.deepEqual(nextDevOrderStep(pending, MAX_DEV_REPOSTS), { kind: 'give-up' });
  });
});

describe('devRetryDelayMs', () => {
  it('converts seconds to milliseconds and caps what a misbehaving server can ask for', () => {
    assert.equal(devRetryDelayMs(1), 1_000);
    assert.equal(devRetryDelayMs(3), 3_000);
    assert.equal(devRetryDelayMs(3_600), 5_000);
  });
});

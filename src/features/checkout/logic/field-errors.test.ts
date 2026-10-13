import assert from 'node:assert/strict';
import test from 'node:test';

import { mapServerFieldErrors } from './field-errors.ts';

test('maps address and item paths without receiving or returning values', () => {
  assert.deepEqual(mapServerFieldErrors({
    'shippingAddress.postalCode': 'invalid',
    'shippingAddress.phone': 'invalid',
    'items[2].quantity': 'invalid',
  }), {
    fields: { postalCode: 'checkout.server.invalid', phone: 'checkout.server.invalid' },
    lines: { 2: { quantity: 'checkout.server.invalid' } },
    global: [],
  });
});

test('unknown, root and missing fields become a global error', () => {
  assert.equal(mapServerFieldErrors({ 'shippingAddress.unknown': 'secret' }).global[0], 'checkout.server.fieldError');
  assert.equal(mapServerFieldErrors({ 'items[0].price': 'secret' }).global[0], 'checkout.server.fieldError');
  assert.equal(mapServerFieldErrors(undefined).global[0], 'checkout.server.genericError');
  assert.equal(mapServerFieldErrors({}).global[0], 'checkout.server.genericError');
  assert.doesNotMatch(JSON.stringify(mapServerFieldErrors({ 'shippingAddress.phone': 'secret' })), /secret/);
});

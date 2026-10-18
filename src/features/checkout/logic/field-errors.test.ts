import assert from 'node:assert/strict';
import test from 'node:test';

import { hasGeneralServerError, mapServerFieldErrors } from './field-errors.ts';

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

// T4b: `checkout.server.fieldError` ("Review this field.") was never shown: the screen draws ONE general
// message (`genericError`) whenever there is a global complaint. The map now names the key that is shown.
test('unknown, root and missing fields become a global error', () => {
  assert.equal(mapServerFieldErrors({ 'shippingAddress.unknown': 'secret' }).global[0], 'checkout.server.genericError');
  assert.equal(mapServerFieldErrors({ 'items[0].price': 'secret' }).global[0], 'checkout.server.genericError');
  assert.equal(mapServerFieldErrors(undefined).global[0], 'checkout.server.genericError');
  assert.equal(mapServerFieldErrors({}).global[0], 'checkout.server.genericError');
  assert.doesNotMatch(JSON.stringify(mapServerFieldErrors({ 'shippingAddress.phone': 'secret' })), /secret/);
});

// T3b: which complaints the form can place under a field and which need the general message.
test('a general message is needed for cart lines, unknown paths and empty bodies, never for address fields alone', () => {
  assert.equal(hasGeneralServerError(mapServerFieldErrors({ 'shippingAddress.phone': 'x', 'shippingAddress.city': 'x' })), false);
  assert.equal(hasGeneralServerError(mapServerFieldErrors({ 'items[0].quantity': 'x' })), true);
  assert.equal(hasGeneralServerError(mapServerFieldErrors({ currency: 'x' })), true);
  assert.equal(hasGeneralServerError(mapServerFieldErrors({ 'shippingAddress.phone': 'x', 'items.1.productId': 'x' })), true);
  assert.equal(hasGeneralServerError(mapServerFieldErrors({})), true);
  assert.equal(hasGeneralServerError(mapServerFieldErrors(undefined)), true);
});

test('only the eight address fields are mapped; a look-alike path is general, not a field', () => {
  const mapped = mapServerFieldErrors({ 'shippingAddress.fullName': 'x', 'shippingAddress.__proto__': 'x', 'shippingAddress.country': 'x' });
  assert.deepEqual(Object.keys(mapped.fields), ['fullName']);
  assert.equal(mapped.global.length, 2);
});

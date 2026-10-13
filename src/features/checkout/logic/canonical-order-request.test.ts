import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalizeOrderRequest, serializeCanonicalOrder } from './canonical-order-request.ts';

const address = { fullName: ' Ana ', phone: '1234567890', postalCode: '01234', state: ' CDMX ', city: ' MX ', street: ' Main ', exteriorNumber: ' 1 ' };

test('canonicalizes trimmed fields, sorted items and recursively sorted keys', () => {
  const request = canonicalizeOrderRequest({ currency: ' MXN ' as 'MXN', shippingAddress: address, items: [{ productId: ' b ', quantity: 2 }, { productId: 'a', quantity: 1 }] });
  assert.deepEqual(request.items.map((item) => item.productId), ['a', 'b']);
  assert.equal(serializeCanonicalOrder(request), '{"currency":"MXN","items":[{"productId":"a","quantity":1},{"productId":"b","quantity":2}],"shippingAddress":{"city":"MX","exteriorNumber":"1","fullName":"Ana","phone":"1234567890","postalCode":"01234","state":"CDMX","street":"Main"}}');
});

test('rejects duplicate products', () => assert.throws(() => canonicalizeOrderRequest({ currency: 'MXN', shippingAddress: address, items: [{ productId: 'a', quantity: 1 }, { productId: 'a', quantity: 2 }] }), /duplicate/i));

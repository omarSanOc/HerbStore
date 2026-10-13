/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildCheckoutRequest } from './checkout-request.ts';

describe('checkout request boundary', () => {
  it('keeps only items, currency and address', () => {
    const request = buildCheckoutRequest([{ productId: 'b', quantity: 2 }, { productId: 'a', quantity: 1 }], 'USD', { fullName: ' Ana ', phone: '1234567890', postalCode: '01010', state: 'CDMX', city: 'MX', street: 'Main', exteriorNumber: '1', interiorNumber: '' });
    assert.deepEqual(request.items, [{ productId: 'b', quantity: 2 }, { productId: 'a', quantity: 1 }]);
    assert.equal('subtotal' in request, false);
  });
});

/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { OrderRequest, ShippingAddress } from '../contracts/order.ts';
import { describeOrderForLog, maskIdempotencyKey } from './order-log.ts';

// A fictitious address, obviously fake: it only exists to prove that the log line never prints it.
const ADDRESS: ShippingAddress = Object.freeze({
  fullName: 'Test Customer',
  phone: '0000000000',
  postalCode: '00000',
  state: 'Test State',
  city: 'Test City',
  street: 'Test Street',
  exteriorNumber: '0',
});

describe('maskIdempotencyKey', () => {
  it('keeps only the last 4 characters, enough to see that two POSTs share a key', () => {
    assert.equal(maskIdempotencyKey('dev-mgx3k2f9-0a1b2c3d'), '…2c3d');
    assert.equal(maskIdempotencyKey('dev-mgx3k2f9-0a1b2c3d'), maskIdempotencyKey('dev-mgx3k2f9-0a1b2c3d'));
    assert.notEqual(maskIdempotencyKey('dev-a-00000001'), maskIdempotencyKey('dev-a-00000002'));
  });

  it('never reveals a short key in full', () => {
    assert.equal(maskIdempotencyKey('abcd'), '…');
    assert.equal(maskIdempotencyKey(''), '…');
  });
});

describe('describeOrderForLog', () => {
  const request: OrderRequest = {
    items: [{ productId: 'product-261009-002', quantity: 1 }],
    currency: 'USD',
    shippingAddress: ADDRESS,
  };

  it('prints status, masked key and product ids for a pending answer', () => {
    assert.equal(
      describeOrderForLog('dev-mgx3k2f9-0a1b2c3d', request, { status: 'pending', retryAfterSeconds: 1 }),
      'POST /orders -> 202 pending retryAfter=1s key=…2c3d products=product-261009-002',
    );
  });

  it('prints status, masked key and product ids for a confirmed answer', () => {
    assert.equal(
      describeOrderForLog('dev-mgx3k2f9-0a1b2c3d', request, { status: 'confirmed', orderId: 'order-1' }),
      'POST /orders -> 200 confirmed key=…2c3d products=product-261009-002',
    );
  });

  it('lists several products and never includes the address, the currency or the body', () => {
    const several: OrderRequest = {
      ...request,
      items: [
        { productId: 'p1', quantity: 2 },
        { productId: 'p2', quantity: 1 },
      ],
    };
    const line = describeOrderForLog('dev-mgx3k2f9-0a1b2c3d', several, {
      status: 'confirmed',
      orderId: 'order-secret-id',
    });

    assert.match(line, /products=p1,p2$/);
    for (const value of Object.values(ADDRESS)) {
      assert.ok(!line.includes(value) || value.length < 2, `leaks "${value}"`);
    }
    assert.ok(!line.includes('shippingAddress'));
    assert.ok(!line.includes('quantity'));
    assert.ok(!line.includes('USD'));
    assert.ok(!line.includes('dev-mgx3k2f9-0a1b2c3d'));
    assert.ok(!line.includes('order-secret-id'));
  });
});

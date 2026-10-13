/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { OrderResult } from '../contracts/order.ts';
import { tagsForOrderResult } from './order-invalidation.ts';

const confirmed: OrderResult = { status: 'confirmed', orderId: 'order-1' };
const pending: OrderResult = { status: 'pending', retryAfterSeconds: 1 };

describe('tagsForOrderResult', () => {
  it('invalidates Home, every product list and each ordered product when confirmed', () => {
    const items = [
      { productId: 'product-2', quantity: 1 },
      { productId: 'product-5', quantity: 3 },
    ];

    assert.deepEqual(tagsForOrderResult(confirmed, items), [
      'Home',
      { type: 'ProductList', id: 'LIST' },
      { type: 'Product', id: 'product-2' },
      { type: 'Product', id: 'product-5' },
    ]);
  });

  it('never repeats a product tag', () => {
    const items = [
      { productId: 'product-2', quantity: 1 },
      { productId: 'product-2', quantity: 4 },
      { productId: 'product-5', quantity: 1 },
      { productId: 'product-2', quantity: 1 },
    ];

    const tags = tagsForOrderResult(confirmed, items);

    assert.deepEqual(
      tags.filter((tag) => typeof tag !== 'string' && tag.type === 'Product'),
      [
        { type: 'Product', id: 'product-2' },
        { type: 'Product', id: 'product-5' },
      ],
    );
    assert.equal(tags.length, 4);
  });

  it('still invalidates Home and the lists for an order without items', () => {
    assert.deepEqual(tagsForOrderResult(confirmed, []), ['Home', { type: 'ProductList', id: 'LIST' }]);
  });

  it('invalidates nothing while the order is only pending (HTTP 202)', () => {
    assert.deepEqual(tagsForOrderResult(pending, [{ productId: 'product-2', quantity: 1 }]), []);
  });

  it('invalidates nothing when the request failed (no result)', () => {
    assert.deepEqual(tagsForOrderResult(undefined, [{ productId: 'product-2', quantity: 1 }]), []);
  });

  it('does not mutate the items it receives', () => {
    const items = Object.freeze([Object.freeze({ productId: 'product-2', quantity: 1 })]);

    assert.doesNotThrow(() => tagsForOrderResult(confirmed, items));
  });
});

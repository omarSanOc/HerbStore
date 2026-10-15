/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { cartFeedbackAction, type CartFeedbackSnapshot } from './cart-feedback.ts';

const line = (quantity: number): CartFeedbackSnapshot['lines'][number] => ({
  productId: 'product-261009-001',
  quantity,
  name: 'Ashwagandha',
  unitPrice: 1000,
  currency: 'MXN',
  stock: 5,
});

const snapshot = (lines: CartFeedbackSnapshot['lines']): CartFeedbackSnapshot => ({ lines });

describe('cartFeedbackAction', () => {
  it('accepts each real human cart mutation', () => {
    assert.equal(cartFeedbackAction('cart/productAdded', snapshot([]), snapshot([line(2)])), 'productAdded');
    assert.equal(cartFeedbackAction('cart/lineIncremented', snapshot([line(1)]), snapshot([line(2)])), 'lineIncremented');
    assert.equal(cartFeedbackAction('cart/lineDecremented', snapshot([line(2)]), snapshot([line(1)])), 'lineDecremented');
    assert.equal(cartFeedbackAction('cart/lineRemoved', snapshot([line(1)]), snapshot([])), 'lineRemoved');
  });

  it('rejects limits, lock/dedupe no-ops and non-human changes', () => {
    assert.equal(cartFeedbackAction('cart/lineIncremented', snapshot([line(5)]), snapshot([line(5)])), undefined);
    assert.equal(cartFeedbackAction('cart/productAdded', snapshot([line(5)]), snapshot([line(5)])), undefined);
    assert.equal(cartFeedbackAction('cart/lineIncremented', snapshot([line(1)]), snapshot([line(1)])), undefined);
    assert.equal(cartFeedbackAction('cart/cartCleared', snapshot([line(2)]), snapshot([])), undefined);
    assert.equal(cartFeedbackAction('cart/stockRefreshed', snapshot([line(2)]), snapshot([line(2)])), undefined);
  });
});

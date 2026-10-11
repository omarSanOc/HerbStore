/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getCartBadge } from './format-cart-badge.ts';

describe('getCartBadge', () => {
  it('hides the badge when the cart is empty', () => {
    assert.equal(getCartBadge(0), undefined);
  });

  it('hides the badge for negative, fractional-below-one and non-finite counts', () => {
    assert.equal(getCartBadge(-3), undefined);
    assert.equal(getCartBadge(0.9), undefined);
    assert.equal(getCartBadge(Number.NaN), undefined);
    assert.equal(getCartBadge(Number.POSITIVE_INFINITY), undefined);
  });

  it('returns the number up to 99', () => {
    assert.equal(getCartBadge(1), 1);
    assert.equal(getCartBadge(5), 5);
    assert.equal(getCartBadge(99), 99);
  });

  it('caps the badge from 100 onwards', () => {
    assert.equal(getCartBadge(100), '99+');
    assert.equal(getCartBadge(1234), '99+');
  });

  it('truncates fractional counts', () => {
    assert.equal(getCartBadge(5.7), 5);
  });
});

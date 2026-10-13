/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { clampQuantity, MIN_QUANTITY, stepQuantity } from './quantity.ts';

describe('clampQuantity: the quantity stays inside [1, stock] (RF-6)', () => {
  it('keeps a quantity that is inside the range and does not call it limited', () => {
    assert.deepEqual(clampQuantity(1, 5), { quantity: 1, limited: false });
    assert.deepEqual(clampQuantity(3, 5), { quantity: 3, limited: false });
  });

  it('allows exactly the stock: reaching the maximum is not exceeding it', () => {
    assert.deepEqual(clampQuantity(5, 5), { quantity: 5, limited: false });
    assert.deepEqual(clampQuantity(1, 1), { quantity: 1, limited: false });
  });

  it('keeps the maximum and says so when the request goes past the stock', () => {
    assert.deepEqual(clampQuantity(6, 5), { quantity: 5, limited: true });
    assert.deepEqual(clampQuantity(500, 5), { quantity: 5, limited: true });
    assert.deepEqual(clampQuantity(2, 1), { quantity: 1, limited: true });
    assert.deepEqual(clampQuantity(Infinity, 5), { quantity: 5, limited: true });
  });

  it('never goes below one unit, and going below is not the stock limit', () => {
    assert.equal(MIN_QUANTITY, 1);
    assert.deepEqual(clampQuantity(0, 5), { quantity: 1, limited: false });
    assert.deepEqual(clampQuantity(-3, 5), { quantity: 1, limited: false });
    assert.deepEqual(clampQuantity(-Infinity, 5), { quantity: 1, limited: false });
  });

  it('turns anything that is not a whole number into a whole one', () => {
    assert.deepEqual(clampQuantity(2.9, 5), { quantity: 2, limited: false });
    assert.deepEqual(clampQuantity(Number.NaN, 5), { quantity: 1, limited: false });
  });

  it('has nothing to choose when the product is sold out or the stock is not usable', () => {
    assert.deepEqual(clampQuantity(1, 0), { quantity: 0, limited: true });
    assert.deepEqual(clampQuantity(3, -2), { quantity: 0, limited: true });
    assert.deepEqual(clampQuantity(3, Number.NaN), { quantity: 0, limited: true });
    assert.deepEqual(clampQuantity(3, Infinity), { quantity: 0, limited: true });
  });

  it('ignores the fraction of a stock that is not whole', () => {
    assert.deepEqual(clampQuantity(5, 4.9), { quantity: 4, limited: true });
  });
});

describe('stepQuantity: one unit up or down from the quantity shown', () => {
  it('adds and removes one unit inside the range', () => {
    assert.deepEqual(stepQuantity(1, 1, 5), { quantity: 2, limited: false });
    assert.deepEqual(stepQuantity(3, -1, 5), { quantity: 2, limited: false });
  });

  it('reaches the stock without calling it a limit, and the next step is the limit', () => {
    assert.deepEqual(stepQuantity(4, 1, 5), { quantity: 5, limited: false });
    assert.deepEqual(stepQuantity(5, 1, 5), { quantity: 5, limited: true });
    assert.deepEqual(stepQuantity(5, 1, 5), { quantity: 5, limited: true });
  });

  it('stays at one when reducing from the minimum, without announcing a stock limit', () => {
    assert.deepEqual(stepQuantity(1, -1, 5), { quantity: 1, limited: false });
  });

  it('starts from the quantity the stock allows when the stock dropped under the selection', () => {
    assert.deepEqual(stepQuantity(8, -1, 3), { quantity: 2, limited: false });
    assert.deepEqual(stepQuantity(8, 1, 3), { quantity: 3, limited: true });
  });

  it('does nothing for a sold out product', () => {
    assert.deepEqual(stepQuantity(1, 1, 0), { quantity: 0, limited: true });
    assert.deepEqual(stepQuantity(1, -1, 0), { quantity: 0, limited: true });
  });

  it('is exhaustive: from every quantity of a small stock both steps stay in range', () => {
    for (let stock = 1; stock <= 6; stock += 1) {
      for (let current = -2; current <= stock + 3; current += 1) {
        for (const step of [1, -1] as const) {
          const { quantity } = stepQuantity(current, step, stock);
          assert.ok(quantity >= 1 && quantity <= stock, `stock ${stock}, ${current}, ${step}`);
        }
      }
    }
  });
});

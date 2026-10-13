/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { CartProduct } from '../logic/cart.ts';
import {
  cartCleared,
  cartReducer,
  lineDecremented,
  lineIncremented,
  lineRemoved,
  productAdded,
  stockRefreshed,
} from './cart-slice.ts';

const ID_A = 'product-261009-001';
const ID_B = 'product-261009-002';

function product(overrides: Partial<CartProduct> = {}): CartProduct {
  return {
    productId: ID_A,
    name: 'Complete Daily Powder',
    imagePath: '/images/products/product-001-front.png',
    unitPrice: 277.9,
    currency: 'MXN',
    stock: 10,
    ...overrides,
  };
}

const init = { type: '@@INIT' };
const empty = cartReducer(undefined, init);

describe('cart slice reducers', () => {
  it('starts with no lines', () => {
    assert.deepEqual(empty, { lines: [] });
  });

  it('the add event is cart/productAdded (the Day 5 haptics/notification listener will watch it)', () => {
    assert.equal(productAdded.type, 'cart/productAdded');
    assert.equal(productAdded({ product: product(), quantity: 1 }).type, 'cart/productAdded');
  });

  it('productAdded stores the snapshot of the product with the quantity', () => {
    const state = cartReducer(empty, productAdded({ product: product(), quantity: 2 }));

    assert.deepEqual(state.lines, [{ ...product(), quantity: 2 }]);
  });

  it('adding the same product twice sums once per action, in one line', () => {
    let state = cartReducer(empty, productAdded({ product: product(), quantity: 2 }));
    state = cartReducer(state, productAdded({ product: product(), quantity: 3 }));

    assert.equal(state.lines.length, 1);
    assert.equal(state.lines[0]?.quantity, 5);
  });

  it('adding beyond the stock keeps the maximum', () => {
    const state = cartReducer(empty, productAdded({ product: product({ stock: 4 }), quantity: 9 }));
    assert.equal(state.lines[0]?.quantity, 4);
  });

  it('lineIncremented and lineDecremented change one unit; from one unit the line goes away', () => {
    let state = cartReducer(empty, productAdded({ product: product(), quantity: 1 }));

    state = cartReducer(state, lineIncremented(ID_A));
    assert.equal(state.lines[0]?.quantity, 2);

    state = cartReducer(state, lineDecremented(ID_A));
    assert.equal(state.lines[0]?.quantity, 1);

    state = cartReducer(state, lineDecremented(ID_A));
    assert.deepEqual(state.lines, []);
  });

  it('lineIncremented stops at the stock', () => {
    let state = cartReducer(empty, productAdded({ product: product({ stock: 2 }), quantity: 2 }));
    state = cartReducer(state, lineIncremented(ID_A));
    assert.equal(state.lines[0]?.quantity, 2);
  });

  it('lineRemoved deletes one line and cartCleared all of them', () => {
    let state = cartReducer(empty, productAdded({ product: product(), quantity: 3 }));
    state = cartReducer(state, productAdded({ product: product({ productId: ID_B }), quantity: 1 }));

    const withoutA = cartReducer(state, lineRemoved(ID_A));
    assert.deepEqual(
      withoutA.lines.map(({ productId }) => productId),
      [ID_B],
    );
    assert.deepEqual(cartReducer(state, cartCleared()).lines, []);
  });

  it('stockRefreshed updates the stock, clamps the quantity and removes sold out lines', () => {
    let state = cartReducer(empty, productAdded({ product: product({ stock: 10 }), quantity: 8 }));
    state = cartReducer(state, productAdded({ product: product({ productId: ID_B, stock: 10 }), quantity: 2 }));

    state = cartReducer(
      state,
      stockRefreshed([
        { productId: ID_A, stock: 3 },
        { productId: ID_B, stock: 0 },
      ]),
    );

    assert.deepEqual(state.lines, [{ ...product({ stock: 3 }), quantity: 3 }]);
  });

  it('an action that changes nothing returns the very same state (no write to storage, no re-render)', () => {
    const state = cartReducer(empty, productAdded({ product: product(), quantity: 1 }));

    assert.equal(cartReducer(state, lineIncremented(ID_B)), state);
    assert.equal(cartReducer(state, lineDecremented(ID_B)), state);
    assert.equal(cartReducer(state, lineRemoved(ID_B)), state);
    assert.equal(cartReducer(state, stockRefreshed([])), state);
    assert.equal(cartReducer(empty, cartCleared()), empty);
    assert.equal(cartReducer(state, productAdded({ product: product({ stock: 0 }), quantity: 1 })), state);
    assert.equal(cartReducer(state, init), state);
  });

  it('never mutates the previous state: it stays equal to its snapshot and keeps untouched lines', () => {
    let before = cartReducer(empty, productAdded({ product: product(), quantity: 2 }));
    before = cartReducer(before, productAdded({ product: product({ productId: ID_B }), quantity: 1 }));
    const snapshot = structuredClone(before);
    const lineB = before.lines[1];

    const after = cartReducer(before, lineIncremented(ID_A));

    assert.deepEqual(before, snapshot);
    assert.notEqual(after, before);
    assert.equal(after.lines[1], lineB);
  });

  it('the state is frozen: an accidental mutation outside the reducer throws instead of corrupting it', () => {
    const state = cartReducer(empty, productAdded({ product: product(), quantity: 1 }));

    assert.throws(() => {
      (state.lines as unknown as { quantity: number }[])[0]!.quantity = 99;
    }, TypeError);
    assert.throws(() => {
      (state.lines as unknown as unknown[]).push({});
    }, TypeError);
  });

  it('every line keeps the snapshot: name, picture, price, currency of origin and stock', () => {
    const state = cartReducer(
      empty,
      productAdded({ product: product({ unitPrice: 11.99, currency: 'USD', stock: 7 }), quantity: 1 }),
    );

    const [only] = state.lines;
    assert.equal(only?.name, 'Complete Daily Powder');
    assert.equal(only?.imagePath, '/images/products/product-001-front.png');
    assert.equal(only?.unitPrice, 11.99);
    assert.equal(only?.currency, 'USD');
    assert.equal(only?.stock, 7);
  });
});

/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { configureStore, type Middleware, type UnknownAction } from '@reduxjs/toolkit';

import { preferencesReducer } from '../../preferences/store/preferences-slice.ts';
import type { CartProduct } from '../logic/cart.ts';
import { addProductToCart } from './add-to-cart.ts';
import { cartReducer } from './cart-slice.ts';

const ID_A = 'product-261009-001';

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

/** A store with the real slices; `rehydrated` stands for redux-persist's `_persist`. */
function createTestStore(rehydrated: boolean) {
  const seen: UnknownAction[] = [];
  const captureActions: Middleware = () => (next) => (action) => {
    seen.push(action as UnknownAction);
    return next(action);
  };
  const store = configureStore({
    reducer: {
      cart: cartReducer,
      preferences: preferencesReducer,
      _persist: (state = { version: 1, rehydrated }) => state,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(captureActions),
  });
  const productAddedCount = () => seen.filter((action) => action.type === 'cart/productAdded').length;

  return { store, productAddedCount };
}

describe('addProductToCart (thunk): decide with the CURRENT state, dispatch once', () => {
  it('dispatches exactly one cart/productAdded and the cart changes in that same dispatch', () => {
    const { store, productAddedCount } = createTestStore(true);

    const outcome = store.dispatch(addProductToCart({ product: product(), quantity: 2 }));

    assert.equal(productAddedCount(), 1);
    assert.deepEqual(outcome, { status: 'added', addedUnits: 2, quantityInCart: 2, limited: false });
    assert.equal(store.getState().cart.lines[0]?.quantity, 2);
  });

  it('adding the same product twice sums, one dispatch per call', () => {
    const { store, productAddedCount } = createTestStore(true);

    store.dispatch(addProductToCart({ product: product(), quantity: 2 }));
    store.dispatch(addProductToCart({ product: product(), quantity: 3 }));

    assert.equal(productAddedCount(), 2);
    assert.equal(store.getState().cart.lines.length, 1);
    assert.equal(store.getState().cart.lines[0]?.quantity, 5);
  });

  it('keeps the maximum when the sum goes past the stock and says so', () => {
    const { store } = createTestStore(true);
    store.dispatch(addProductToCart({ product: product({ stock: 3 }), quantity: 2 }));

    const outcome = store.dispatch(addProductToCart({ product: product({ stock: 3 }), quantity: 2 }));

    assert.deepEqual(outcome, { status: 'added', addedUnits: 1, quantityInCart: 3, limited: true });
    assert.equal(store.getState().cart.lines[0]?.quantity, 3);
  });

  it('does not dispatch when the cart already holds the maximum', () => {
    const { store, productAddedCount } = createTestStore(true);
    store.dispatch(addProductToCart({ product: product({ stock: 2 }), quantity: 2 }));
    const stateBefore = store.getState().cart;

    const outcome = store.dispatch(addProductToCart({ product: product({ stock: 2 }), quantity: 1 }));

    assert.deepEqual(outcome, { status: 'at-limit', quantityInCart: 2 });
    assert.equal(productAddedCount(), 1);
    assert.equal(store.getState().cart, stateBefore);
  });

  it('respects the lock: while the cart is restoring nothing is dispatched', () => {
    const { store, productAddedCount } = createTestStore(false);
    const stateBefore = store.getState().cart;

    const outcome = store.dispatch(addProductToCart({ product: product(), quantity: 1 }));

    assert.deepEqual(outcome, { status: 'locked' });
    assert.equal(productAddedCount(), 0);
    assert.equal(store.getState().cart, stateBefore);
  });

  it('a sold out product dispatches nothing', () => {
    const { store, productAddedCount } = createTestStore(true);

    const outcome = store.dispatch(addProductToCart({ product: product({ stock: 0 }), quantity: 1 }));

    assert.deepEqual(outcome, { status: 'sold-out' });
    assert.equal(productAddedCount(), 0);
    assert.deepEqual(store.getState().cart.lines, []);
  });
});

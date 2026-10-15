/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { configureStore } from '@reduxjs/toolkit';

import { acceptAddPress } from '../../cart/logic/add-to-cart.ts';
import type { CartProduct } from '../../cart/logic/cart.ts';
import { selectCartUnits } from '../../cart/logic/cart-selectors.ts';
import { getCartBadge } from '../../cart/format-cart-badge.ts';
import { addProductToCart } from '../../cart/store/add-to-cart.ts';
import {
  cartCleared,
  cartReducer,
  lineDecremented,
  lineIncremented,
  lineRemoved,
  stockRefreshed,
} from '../../cart/store/cart-slice.ts';
import { preferencesReducer } from '../../preferences/store/preferences-slice.ts';
import { createCartFeedbackListener } from './cart-feedback-listener.ts';

const ID_A = 'product-261009-002';
const ID_B = 'product-261009-003';
const ID_SOLD_OUT = 'product-261009-001';

function product(productId: string, stock: number): CartProduct {
  return {
    productId,
    name: `Herb ${productId}`,
    imagePath: '/images/products/p.png',
    unitPrice: 100,
    currency: 'MXN',
    stock,
  };
}

/**
 * The real slices and the real thunk, with the listener under test. `rehydrated` stands for
 * redux-persist's `_persist` (false = the cart is locked). `impact` counts the impacts requested.
 */
function createHarness(options: { rehydrated?: boolean; impact?: () => Promise<unknown> | void } = {}) {
  let impacts = 0;
  const listener = createCartFeedbackListener(() => {
    impacts += 1;
    return options.impact?.();
  });
  const store = configureStore({
    reducer: {
      cart: cartReducer,
      preferences: preferencesReducer,
      _persist: (state = { version: 1, rehydrated: options.rehydrated ?? true }) => state,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().prepend(listener.middleware),
  });
  const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
  const badge = () => getCartBadge(selectCartUnits(store.getState()));

  return { store, settle, badge, impacts: () => impacts };
}

describe('cart feedback listener: exactly one light impact per REAL cart mutation', () => {
  it('requests one impact for each of the four accepted mutations and the badge sums UNITS', async () => {
    const { store, settle, badge, impacts } = createHarness();

    store.dispatch(addProductToCart({ product: product(ID_A, 99), quantity: 2 }));
    await settle();
    assert.equal(impacts(), 1, 'add 2 units of A is ONE mutation, not two');
    assert.equal(badge(), 2);

    store.dispatch(addProductToCart({ product: product(ID_B, 99), quantity: 1 }));
    await settle();
    assert.equal(impacts(), 2);
    assert.equal(badge(), 3, 'badge = 2 + 1 units across two lines (not 2 lines)');

    store.dispatch(lineIncremented(ID_A));
    await settle();
    assert.equal(impacts(), 3);
    assert.equal(badge(), 4);

    store.dispatch(lineDecremented(ID_A));
    await settle();
    assert.equal(impacts(), 4);
    assert.equal(badge(), 3);

    store.dispatch(lineRemoved(ID_A));
    await settle();
    assert.equal(impacts(), 5);
    assert.equal(badge(), 1);
  });

  it('a decrement from one unit removes the line and still counts as one mutation', async () => {
    const { store, settle, badge, impacts } = createHarness();
    store.dispatch(addProductToCart({ product: product(ID_A, 99), quantity: 1 }));
    await settle();

    store.dispatch(lineDecremented(ID_A));
    await settle();

    assert.equal(impacts(), 2);
    assert.equal(store.getState().cart.lines.length, 0);
    assert.equal(badge(), undefined);
  });

  it('requests nothing for an increment at the stock limit, and the state is untouched', async () => {
    const { store, settle, impacts } = createHarness();
    store.dispatch(addProductToCart({ product: product(ID_A, 2), quantity: 2 }));
    await settle();
    const before = store.getState().cart;

    store.dispatch(lineIncremented(ID_A));
    await settle();

    assert.equal(impacts(), 1, 'only the initial add');
    assert.equal(store.getState().cart, before);
  });

  it('requests nothing for lines that do not exist (increment, decrement, remove)', async () => {
    const { store, settle, impacts } = createHarness();
    store.dispatch(addProductToCart({ product: product(ID_A, 99), quantity: 1 }));
    await settle();

    store.dispatch(lineIncremented(ID_B));
    store.dispatch(lineDecremented(ID_B));
    store.dispatch(lineRemoved(ID_B));
    await settle();

    assert.equal(impacts(), 1, 'only the initial add');
  });

  it('requests nothing for an add the thunk rejects: locked, at the limit, sold out or invalid', async () => {
    const locked = createHarness({ rehydrated: false });
    const outcome = locked.store.dispatch(
      addProductToCart({ product: product(ID_A, 99), quantity: 1 }),
    );
    await locked.settle();
    assert.equal(outcome.status, 'locked');
    assert.equal(locked.impacts(), 0);
    assert.equal(locked.badge(), undefined);

    const { store, settle, impacts } = createHarness();
    store.dispatch(addProductToCart({ product: product(ID_A, 1), quantity: 1 }));
    await settle();
    assert.equal(impacts(), 1);

    assert.equal(
      store.dispatch(addProductToCart({ product: product(ID_A, 1), quantity: 1 })).status,
      'at-limit',
    );
    assert.equal(
      store.dispatch(addProductToCart({ product: product(ID_SOLD_OUT, 0), quantity: 1 })).status,
      'sold-out',
    );
    assert.equal(
      store.dispatch(addProductToCart({ product: product(ID_B, 99), quantity: 0 })).status,
      'ignored',
    );
    assert.equal(
      store.dispatch(addProductToCart({ product: product(ID_B, 99), quantity: 1.5 })).status,
      'ignored',
    );
    await settle();

    assert.equal(impacts(), 1, 'none of the four rejected presses requested an impact');
  });

  it('a double tap grouped by the 700 ms lockout is one mutation and one impact', async () => {
    const { store, settle, impacts } = createHarness();
    let lastAccepted: number | undefined;
    // The same composition as the detail screen: the lockout decides BEFORE the dispatch.
    const press = (now: number) => {
      if (!acceptAddPress(lastAccepted, now)) return;
      lastAccepted = now;
      store.dispatch(addProductToCart({ product: product(ID_A, 99), quantity: 1 }));
    };

    press(1000);
    press(1100);
    press(1699);
    await settle();
    assert.equal(impacts(), 1);
    assert.equal(store.getState().cart.lines[0]?.quantity, 1);

    press(1700);
    await settle();
    assert.equal(impacts(), 2, 'a deliberate second add after the lockout is a new mutation');
    assert.equal(store.getState().cart.lines[0]?.quantity, 2);
  });

  it('does not treat system or bulk changes as human mutations (clear, stock refresh)', async () => {
    const { store, settle, impacts } = createHarness();
    store.dispatch(addProductToCart({ product: product(ID_A, 5), quantity: 3 }));
    await settle();

    store.dispatch(stockRefreshed([{ productId: ID_A, stock: 2 }]));
    await settle();
    assert.equal(store.getState().cart.lines[0]?.quantity, 2, 'the refresh did change the cart');
    assert.equal(impacts(), 1, 'but it is not a tap');

    store.dispatch(cartCleared());
    await settle();
    assert.equal(store.getState().cart.lines.length, 0);
    assert.equal(impacts(), 1);
  });

  it('a failing or throwing native actuator never blocks or undoes the cart change', async (t) => {
    // RTK reports an uncaught listener error with console.error: absorbed failures must stay silent.
    const consoleError = t.mock.method(console, 'error', () => {});
    const rejecting = createHarness({ impact: () => Promise.reject(new Error('no actuator')) });
    rejecting.store.dispatch(addProductToCart({ product: product(ID_A, 99), quantity: 2 }));
    assert.equal(rejecting.badge(), 2, 'the state is already final when dispatch returns');
    await rejecting.settle();
    assert.equal(rejecting.badge(), 2);
    assert.equal(rejecting.impacts(), 1);

    const throwing = createHarness({
      impact: () => {
        throw new Error('ExpoHaptics is not available');
      },
    });
    throwing.store.dispatch(addProductToCart({ product: product(ID_A, 99), quantity: 1 }));
    throwing.store.dispatch(lineIncremented(ID_A));
    await throwing.settle();
    assert.equal(throwing.badge(), 2);
    assert.equal(throwing.impacts(), 2, 'a failure on the first one does not mute the next');
    assert.equal(consoleError.mock.callCount(), 0, 'the failures were absorbed, not reported as bugs');
  });

  it('an impact that never resolves does not delay the next mutation or its own request', async () => {
    const { store, settle, badge, impacts } = createHarness({ impact: () => new Promise(() => {}) });

    store.dispatch(addProductToCart({ product: product(ID_A, 99), quantity: 1 }));
    store.dispatch(lineIncremented(ID_A));
    await settle();

    assert.equal(badge(), 2);
    assert.equal(impacts(), 2);
  });
});

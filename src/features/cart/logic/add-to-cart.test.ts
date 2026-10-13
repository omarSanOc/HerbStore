/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { CartLine, CartLines, CartProduct } from './cart.ts';
import {
  acceptAddPress,
  ADD_PRESS_LOCKOUT_MS,
  planAdd,
  quantityInCart,
  toCartProduct,
} from './add-to-cart.ts';

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

function line(overrides: Partial<CartLine> = {}): CartLine {
  return { ...product(), quantity: 1, ...overrides };
}

function frozen(lines: CartLine[]): CartLines {
  return Object.freeze(lines.map((entry) => Object.freeze(entry)));
}

describe('acceptAddPress: only the first press of a double tap changes the cart (RF-7)', () => {
  it('accepts the very first press', () => {
    assert.equal(acceptAddPress(undefined, 0), true);
    assert.equal(acceptAddPress(undefined, 123456), true);
  });

  it('rejects a second press inside the lockout window', () => {
    assert.equal(acceptAddPress(1000, 1000), false);
    assert.equal(acceptAddPress(1000, 1000 + 120), false);
    assert.equal(acceptAddPress(1000, 1000 + ADD_PRESS_LOCKOUT_MS - 1), false);
  });

  it('accepts a deliberate second press once the window is over', () => {
    assert.equal(acceptAddPress(1000, 1000 + ADD_PRESS_LOCKOUT_MS), true);
    assert.equal(acceptAddPress(1000, 1000 + ADD_PRESS_LOCKOUT_MS + 1), true);
  });

  it('never gets stuck if the clock goes backwards', () => {
    assert.equal(acceptAddPress(5000, 100), true);
  });

  it('keeps the window above a double tap and below a person reading the message', () => {
    assert.ok(ADD_PRESS_LOCKOUT_MS >= 500);
    assert.ok(ADD_PRESS_LOCKOUT_MS <= 1000);
  });
});

describe('toCartProduct: the minimal snapshot taken when adding', () => {
  const detail = {
    id: ID_A,
    name: 'Complete Daily Powder',
    price: 277.9,
    listPrice: 320,
    currency: 'MXN' as const,
    stock: 7,
    images: ['/images/products/product-001-front.png', '/images/products/product-001-back.png'],
    brand: 'Sample Brand',
    rating: 4.5,
  };

  it('keeps name, first picture, final price, currency of origin and the live stock', () => {
    assert.deepEqual(toCartProduct(detail), {
      productId: ID_A,
      name: 'Complete Daily Powder',
      imagePath: '/images/products/product-001-front.png',
      unitPrice: 277.9,
      currency: 'MXN',
      stock: 7,
    });
  });

  it('uses the final price (not the list price) and the currency of origin, not the preferred one', () => {
    const usd = toCartProduct({ ...detail, price: 11.99, currency: 'USD' });

    assert.equal(usd.unitPrice, 11.99);
    assert.equal(usd.currency, 'USD');
  });

  it('has no picture path when the product has no pictures', () => {
    const result = toCartProduct({ ...detail, images: [] });

    assert.equal('imagePath' in result, false);
  });

  it('copies nothing else from the product', () => {
    assert.deepEqual(Object.keys(toCartProduct(detail)).sort(), [
      'currency',
      'imagePath',
      'name',
      'productId',
      'stock',
      'unitPrice',
    ]);
  });
});

describe('quantityInCart', () => {
  it('reads the units of one product, 0 when it is not in the cart', () => {
    const lines = frozen([line({ quantity: 3 }), line({ productId: ID_B, quantity: 2 })]);

    assert.equal(quantityInCart(lines, ID_A), 3);
    assert.equal(quantityInCart(lines, ID_B), 2);
    assert.equal(quantityInCart(lines, 'product-unknown'), 0);
    assert.equal(quantityInCart(frozen([]), ID_A), 0);
  });
});

describe('planAdd: what happens when the person presses "Add to cart" (RF-6, RF-7)', () => {
  it('adds the chosen quantity to an empty cart with ONE dispatch', () => {
    const plan = planAdd({ lines: frozen([]), locked: false, product: product({ stock: 5 }), quantity: 2 });

    assert.deepEqual(plan.outcome, {
      status: 'added',
      addedUnits: 2,
      quantityInCart: 2,
      limited: false,
    });
    assert.equal(plan.shouldDispatch, true);
  });

  it('adding the same product again sums on top of what is already there', () => {
    const plan = planAdd({
      lines: frozen([line({ quantity: 2 })]),
      locked: false,
      product: product(),
      quantity: 3,
    });

    assert.deepEqual(plan.outcome, { status: 'added', addedUnits: 3, quantityInCart: 5, limited: false });
    assert.equal(plan.shouldDispatch, true);
  });

  it('keeps the maximum and flags the limit when the SUM goes past the stock', () => {
    const plan = planAdd({
      lines: frozen([line({ quantity: 2, stock: 3 })]),
      locked: false,
      product: product({ stock: 3 }),
      quantity: 2,
    });

    assert.deepEqual(plan.outcome, { status: 'added', addedUnits: 1, quantityInCart: 3, limited: true });
    assert.equal(plan.shouldDispatch, true);
  });

  it('keeps the maximum when one request alone goes past the stock', () => {
    const plan = planAdd({ lines: frozen([]), locked: false, product: product({ stock: 4 }), quantity: 9 });

    assert.deepEqual(plan.outcome, { status: 'added', addedUnits: 4, quantityInCart: 4, limited: true });
  });

  it('also says the cart holds the maximum when the sum reaches the stock exactly', () => {
    const plan = planAdd({
      lines: frozen([line({ quantity: 2, stock: 3 })]),
      locked: false,
      product: product({ stock: 3 }),
      quantity: 1,
    });

    assert.deepEqual(plan.outcome, { status: 'added', addedUnits: 1, quantityInCart: 3, limited: true });
  });

  it('a single unit of a product with one unit in stock is already the maximum', () => {
    const plan = planAdd({ lines: frozen([]), locked: false, product: product({ stock: 1 }), quantity: 1 });

    assert.deepEqual(plan.outcome, { status: 'added', addedUnits: 1, quantityInCart: 1, limited: true });
  });

  it('adds nothing and dispatches nothing when the cart already holds the maximum', () => {
    const plan = planAdd({
      lines: frozen([line({ quantity: 3, stock: 3 })]),
      locked: false,
      product: product({ stock: 3 }),
      quantity: 1,
    });

    assert.deepEqual(plan.outcome, { status: 'at-limit', quantityInCart: 3 });
    assert.equal(plan.shouldDispatch, false);
  });

  it('cuts a line that is above a stock that dropped, and does not call that "added"', () => {
    const plan = planAdd({
      lines: frozen([line({ quantity: 3, stock: 10 })]),
      locked: false,
      product: product({ stock: 2 }),
      quantity: 1,
    });

    assert.deepEqual(plan.outcome, { status: 'at-limit', quantityInCart: 2 });
    assert.equal(plan.shouldDispatch, true);
  });

  it('a sold out product changes nothing', () => {
    const plan = planAdd({ lines: frozen([]), locked: false, product: product({ stock: 0 }), quantity: 1 });

    assert.deepEqual(plan.outcome, { status: 'sold-out' });
    assert.equal(plan.shouldDispatch, false);
  });

  it('a sold out product keeps what the cart already had (the cart screen handles it)', () => {
    const plan = planAdd({
      lines: frozen([line({ quantity: 2 })]),
      locked: false,
      product: product({ stock: 0 }),
      quantity: 1,
    });

    assert.deepEqual(plan.outcome, { status: 'sold-out' });
    assert.equal(plan.shouldDispatch, false);
  });

  it('a locked cart (rehydrating) is never changed, whatever the product says', () => {
    const open = planAdd({ lines: frozen([]), locked: true, product: product(), quantity: 1 });
    const soldOut = planAdd({ lines: frozen([]), locked: true, product: product({ stock: 0 }), quantity: 1 });

    assert.deepEqual(open.outcome, { status: 'locked' });
    assert.equal(open.shouldDispatch, false);
    assert.deepEqual(soldOut.outcome, { status: 'locked' });
    assert.equal(soldOut.shouldDispatch, false);
  });

  it('ignores a quantity that is not a whole number of at least one', () => {
    for (const quantity of [0, -1, 1.5, Number.NaN]) {
      const plan = planAdd({ lines: frozen([]), locked: false, product: product(), quantity });

      assert.deepEqual(plan.outcome, { status: 'ignored' }, String(quantity));
      assert.equal(plan.shouldDispatch, false, String(quantity));
    }
  });

  it('does not mutate the lines it receives', () => {
    const lines = frozen([line({ quantity: 2 }), line({ productId: ID_B, quantity: 1, name: 'Other' })]);

    planAdd({ lines, locked: false, product: product(), quantity: 3 });

    assert.equal(lines.length, 2);
    assert.equal(lines[0]?.quantity, 2);
    assert.equal(lines[1]?.quantity, 1);
  });
});

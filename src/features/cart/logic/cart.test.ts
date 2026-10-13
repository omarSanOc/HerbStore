/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  addLine,
  applyStockRefresh,
  cartSubtotalMxnCents,
  cartUnits,
  clearCart,
  decrementLine,
  EMPTY_CART,
  incrementLine,
  removeLine,
  restoreCartLines,
  type CartLine,
  type CartLines,
  type CartProduct,
} from './cart.ts';

function product(overrides: Partial<CartProduct> = {}): CartProduct {
  return {
    productId: 'product-261009-001',
    name: 'Complete Daily Powder',
    imagePath: '/images/products/product-001-front.png',
    unitPrice: 277.9,
    currency: 'MXN',
    stock: 99,
    ...overrides,
  };
}

function line(overrides: Partial<CartLine> = {}): CartLine {
  return { ...product(), quantity: 1, ...overrides };
}

/** Freezes deeply so any mutation by the code under test throws (modules run in strict mode). */
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

const ID_A = 'product-261009-001';
const ID_B = 'product-261009-002';
const ID_C = 'product-261009-003';

describe('addLine', () => {
  it('adds a new line at the end with the snapshot of the product and the quantity', () => {
    const result = addLine(EMPTY_CART, product(), 2);

    assert.deepEqual(result.lines, [
      {
        productId: ID_A,
        quantity: 2,
        name: 'Complete Daily Powder',
        imagePath: '/images/products/product-001-front.png',
        unitPrice: 277.9,
        currency: 'MXN',
        stock: 99,
      },
    ]);
    assert.equal(result.limited, false);
  });

  it('keeps the currency of origin of the price (a USD product stays USD)', () => {
    const { lines } = addLine(EMPTY_CART, product({ unitPrice: 11.99, currency: 'USD' }), 1);
    assert.equal(lines[0]?.currency, 'USD');
    assert.equal(lines[0]?.unitPrice, 11.99);
  });

  it('has no imagePath key when the product has no picture', () => {
    const { imagePath: _ignored, ...withoutImage } = product();
    const { lines } = addLine(EMPTY_CART, withoutImage, 1);
    assert.equal('imagePath' in (lines[0] ?? {}), false);
  });

  it('adding the same product twice sums ONCE per call, in a single line', () => {
    const first = addLine(EMPTY_CART, product(), 2).lines;
    const second = addLine(first, product(), 3).lines;

    assert.equal(second.length, 1);
    assert.equal(second[0]?.quantity, 5);
  });

  it('appends new products and keeps the position of an existing one', () => {
    const lines = addLine(addLine(EMPTY_CART, product(), 1).lines, product({ productId: ID_B }), 1).lines;
    const again = addLine(lines, product(), 1).lines;

    assert.deepEqual(
      again.map(({ productId }) => productId),
      [ID_A, ID_B],
    );
    assert.equal(again[0]?.quantity, 2);
  });

  it('clamps to the stock and reports the limit when the sum exceeds it', () => {
    const start = [line({ quantity: 4, stock: 5 })];
    const result = addLine(start, product({ stock: 5 }), 3);

    assert.equal(result.lines[0]?.quantity, 5);
    assert.equal(result.limited, true);
  });

  it('clamps a new line to the stock too', () => {
    const result = addLine(EMPTY_CART, product({ stock: 3 }), 10);
    assert.equal(result.lines[0]?.quantity, 3);
    assert.equal(result.limited, true);
  });

  it('reaching the stock exactly is not exceeding it', () => {
    const result = addLine([line({ quantity: 4, stock: 5 })], product({ stock: 5 }), 1);
    assert.equal(result.lines[0]?.quantity, 5);
    assert.equal(result.limited, false);
  });

  it('at the stock already, adding more changes nothing (same lines) and reports the limit', () => {
    const start: CartLines = [line({ quantity: 5, stock: 5 })];
    const result = addLine(start, product({ stock: 5 }), 1);

    assert.equal(result.lines, start);
    assert.equal(result.limited, true);
  });

  it('refreshes the snapshot of an existing line from the product just seen, keeping the quantity', () => {
    const start = [line({ quantity: 2, unitPrice: 100, name: 'Old name', stock: 10 })];
    const result = addLine(start, product({ unitPrice: 120, name: 'New name', stock: 8 }), 1);

    assert.deepEqual(result.lines[0], line({ quantity: 3, unitPrice: 120, name: 'New name', stock: 8 }));
  });

  it('a fresh lower stock also clamps the sum', () => {
    const start = [line({ quantity: 6, stock: 10 })];
    const result = addLine(start, product({ stock: 4 }), 1);

    assert.equal(result.lines[0]?.quantity, 4);
    assert.equal(result.lines[0]?.stock, 4);
    assert.equal(result.limited, true);
  });

  it('a sold out product (stock 0) is never added', () => {
    const result = addLine(EMPTY_CART, product({ stock: 0 }), 1);
    assert.equal(result.lines, EMPTY_CART);
    assert.equal(result.limited, true);
  });

  it('ignores a quantity that is not a whole number of at least one', () => {
    for (const quantity of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = addLine(EMPTY_CART, product(), quantity);
      assert.equal(result.lines, EMPTY_CART, String(quantity));
      assert.equal(result.limited, false, String(quantity));
    }
  });

  it('ignores a snapshot that is not valid', () => {
    for (const bad of [
      product({ productId: '' }),
      product({ name: '' }),
      product({ unitPrice: Number.NaN }),
      product({ unitPrice: -1 }),
      product({ currency: 'EUR' as never }),
      product({ stock: 1.5 }),
      product({ stock: -1 }),
      product({ imagePath: '' }),
    ]) {
      assert.equal(addLine(EMPTY_CART, bad, 1).lines, EMPTY_CART, JSON.stringify(bad));
    }
  });

  it('does not mutate the previous lines and keeps the untouched ones by reference', () => {
    const untouched = line({ productId: ID_B });
    const previous: CartLines = deepFreeze([line({ quantity: 1 }), untouched]);

    const next = addLine(previous, product(), 2).lines;

    assert.notEqual(next, previous);
    assert.equal(previous[0]?.quantity, 1);
    assert.equal(next[0]?.quantity, 3);
    assert.equal(next[1], untouched);
  });
});

describe('incrementLine', () => {
  it('adds one unit to that line only', () => {
    const other = line({ productId: ID_B, quantity: 4 });
    const next = incrementLine([line({ quantity: 2 }), other], ID_A);

    assert.equal(next[0]?.quantity, 3);
    assert.equal(next[1], other);
  });

  it('stops at the stock and returns the same lines', () => {
    const start: CartLines = [line({ quantity: 5, stock: 5 })];
    assert.equal(incrementLine(start, ID_A), start);
  });

  it('an unknown product changes nothing', () => {
    const start: CartLines = [line()];
    assert.equal(incrementLine(start, ID_B), start);
  });

  it('does not mutate the previous lines', () => {
    const previous = deepFreeze([line({ quantity: 1 })]);
    assert.equal(incrementLine(previous, ID_A)[0]?.quantity, 2);
    assert.equal(previous[0]?.quantity, 1);
  });
});

describe('decrementLine', () => {
  it('removes one unit', () => {
    assert.equal(decrementLine([line({ quantity: 3 })], ID_A)[0]?.quantity, 2);
  });

  it('from a single unit it removes the line (never a line with quantity 0)', () => {
    const next = decrementLine([line({ quantity: 1 }), line({ productId: ID_B, quantity: 2 })], ID_A);

    assert.deepEqual(
      next.map(({ productId }) => productId),
      [ID_B],
    );
  });

  it('removing the last line gives the empty cart', () => {
    assert.deepEqual(decrementLine([line({ quantity: 1 })], ID_A), []);
  });

  it('an unknown product changes nothing', () => {
    const start: CartLines = [line()];
    assert.equal(decrementLine(start, ID_B), start);
  });

  it('does not mutate the previous lines', () => {
    const previous = deepFreeze([line({ quantity: 2 })]);
    decrementLine(previous, ID_A);
    assert.equal(previous[0]?.quantity, 2);
  });
});

describe('removeLine and clearCart', () => {
  it('removeLine deletes that product whatever its quantity', () => {
    const next = removeLine([line({ quantity: 9 }), line({ productId: ID_B })], ID_A);
    assert.deepEqual(
      next.map(({ productId }) => productId),
      [ID_B],
    );
  });

  it('removeLine of an unknown product returns the same lines', () => {
    const start: CartLines = [line()];
    assert.equal(removeLine(start, ID_C), start);
  });

  it('clearCart empties a cart and returns the same reference for an empty one', () => {
    assert.deepEqual(clearCart([line()]), []);
    assert.equal(clearCart(EMPTY_CART), EMPTY_CART);
  });
});

describe('cartUnits and cartSubtotalMxnCents (all arithmetic in whole MXN cents)', () => {
  it('an empty cart has no units and a zero subtotal', () => {
    assert.equal(cartUnits(EMPTY_CART), 0);
    assert.equal(cartSubtotalMxnCents(EMPTY_CART), 0);
  });

  it('adds the quantities of every line', () => {
    assert.equal(cartUnits([line({ quantity: 2 }), line({ productId: ID_B, quantity: 99 })]), 101);
  });

  it('sums price x quantity of every line in MXN cents, converting USD lines by 18', () => {
    const lines = [
      line({ unitPrice: 100.5, currency: 'MXN', quantity: 2 }), // 20 100
      line({ productId: ID_B, unitPrice: 10, currency: 'USD', quantity: 1 }), // 18 000
    ];
    assert.equal(cartSubtotalMxnCents(lines), 38_100);
  });

  it('is exact where floating point sums would drift', () => {
    const lines = [0.1, 0.2, 0.3].map((unitPrice, index) =>
      line({ productId: `product-261009-00${index + 1}`, unitPrice }),
    );
    assert.equal(cartSubtotalMxnCents(lines), 60);
  });

  it('799.99, 800.00 and 800.01 MXN are three different canonical values', () => {
    for (const [price, cents] of [
      [799.99, 79_999],
      [800, 80_000],
      [800.01, 80_001],
    ] as const) {
      assert.equal(cartSubtotalMxnCents([line({ unitPrice: price })]), cents, String(price));
    }
  });
});

describe('restoreCartLines (storage is untrusted: line by line)', () => {
  it('returns the empty cart when the slice itself is unreadable', () => {
    for (const stored of [undefined, null, 'cart', 7, {}, { lines: [] }, true]) {
      assert.deepEqual(restoreCartLines(stored), [], JSON.stringify(stored));
    }
  });

  it('accepts valid lines intact and in the same order', () => {
    const stored = [line({ quantity: 3, stock: 10 }), line({ productId: ID_B, currency: 'USD', unitPrice: 9.99 })];
    assert.deepEqual(restoreCartLines(stored), stored);
  });

  it('accepts a line without picture', () => {
    const { imagePath: _ignored, ...withoutImage } = line();
    assert.deepEqual(restoreCartLines([withoutImage]), [withoutImage]);
  });

  const invalidLines: readonly (readonly [string, unknown])[] = [
    ['not an object', 'product-261009-001'],
    ['null', null],
    ['an array', [ID_A]],
    ['no productId', { ...line(), productId: undefined }],
    ['an empty productId', line({ productId: '' })],
    ['no name (no valid snapshot)', { ...line(), name: undefined }],
    ['an empty name', line({ name: '' })],
    ['a picture that is not text', { ...line(), imagePath: 7 }],
    ['an empty picture', line({ imagePath: '' })],
    ['a null picture', { ...line(), imagePath: null }],
    ['quantity 0', line({ quantity: 0 })],
    ['a fractional quantity', line({ quantity: 1.5 })],
    ['a text quantity', { ...line(), quantity: '2' }],
    ['a quantity above its stock', line({ quantity: 6, stock: 5 })],
    ['stock 0 (a sold out line would have been removed)', line({ quantity: 1, stock: 0 })],
    ['a fractional stock', line({ stock: 2.5 })],
    ['a text price', { ...line(), unitPrice: '10' }],
    ['a negative price', line({ unitPrice: -1 })],
    ['an infinite price', line({ unitPrice: Number.POSITIVE_INFINITY })],
    ['an unsupported currency', { ...line(), currency: 'EUR' }],
    ['a line total that is not a safe integer', line({ unitPrice: 1e300, quantity: 2 })],
  ];

  for (const [label, bad] of invalidLines) {
    it(`discards only the line with ${label}, keeping its valid neighbours`, () => {
      const before = line({ productId: ID_B });
      const after = line({ productId: ID_C, quantity: 2 });

      assert.deepEqual(restoreCartLines([before, bad, after]), [before, after]);
    });
  }

  it('every line invalid gives the empty cart', () => {
    assert.deepEqual(restoreCartLines([null, { productId: ID_A }, 3]), []);
  });

  it('keeps the first of two lines with the same productId', () => {
    const first = line({ quantity: 1, name: 'First' });
    const second = line({ quantity: 4, name: 'Second' });

    assert.deepEqual(restoreCartLines([first, line({ productId: ID_B }), second]), [first, line({ productId: ID_B })]);
  });

  it('drops any property that is not part of the snapshot', () => {
    const restored = restoreCartLines([{ ...line(), phone: '5555555555', extra: { a: 1 } }]);
    assert.deepEqual(restored, [line()]);
    assert.deepEqual(Object.keys(restored[0] ?? {}).sort(), [
      'currency',
      'imagePath',
      'name',
      'productId',
      'quantity',
      'stock',
      'unitPrice',
    ]);
  });

  it('does not alias the stored objects', () => {
    const stored = [line()];
    const restored = restoreCartLines(stored);
    assert.notEqual(restored[0], stored[0]);
  });
});

describe('applyStockRefresh (the cart stays consistent: 1 <= quantity <= stock)', () => {
  it('updates the stock and clamps the quantity above it, reporting the adjustment', () => {
    const start = [line({ quantity: 8, stock: 10 })];
    const result = applyStockRefresh(start, [{ productId: ID_A, stock: 3 }]);

    assert.deepEqual(result.lines, [line({ quantity: 3, stock: 3 })]);
    assert.deepEqual(result.adjustments, [
      { productId: ID_A, name: 'Complete Daily Powder', previousQuantity: 8, quantity: 3, stock: 3, removed: false },
    ]);
  });

  it('removes the line when the product is sold out and reports it with its name', () => {
    const start = [line({ quantity: 2 }), line({ productId: ID_B, name: 'Other' })];
    const result = applyStockRefresh(start, [{ productId: ID_A, stock: 0 }]);

    assert.deepEqual(
      result.lines.map(({ productId }) => productId),
      [ID_B],
    );
    assert.deepEqual(result.adjustments, [
      { productId: ID_A, name: 'Complete Daily Powder', previousQuantity: 2, quantity: 0, stock: 0, removed: true },
    ]);
  });

  it('a higher stock only updates the stock: the quantity is the user\'s, no adjustment', () => {
    const start = [line({ quantity: 3, stock: 3 })];
    const result = applyStockRefresh(start, [{ productId: ID_A, stock: 50 }]);

    assert.deepEqual(result.lines, [line({ quantity: 3, stock: 50 })]);
    assert.deepEqual(result.adjustments, []);
  });

  it('a lower stock that still covers the quantity updates the stock without an adjustment', () => {
    const result = applyStockRefresh([line({ quantity: 2, stock: 99 })], [{ productId: ID_A, stock: 2 }]);

    assert.deepEqual(result.lines, [line({ quantity: 2, stock: 2 })]);
    assert.deepEqual(result.adjustments, []);
  });

  it('lines without an update keep their reference; updates for products not in the cart are ignored', () => {
    const untouched = line({ productId: ID_B });
    const result = applyStockRefresh([line({ quantity: 5 }), untouched], [
      { productId: ID_A, stock: 5 },
      { productId: ID_C, stock: 0 },
    ]);

    assert.equal(result.lines[1], untouched);
    assert.equal(result.lines.length, 2);
  });

  it('nothing to change returns the same lines and no adjustments', () => {
    const start: CartLines = [line({ stock: 7 })];
    const same = applyStockRefresh(start, [{ productId: ID_A, stock: 7 }]);
    const empty = applyStockRefresh(start, []);

    assert.equal(same.lines, start);
    assert.deepEqual(same.adjustments, []);
    assert.equal(empty.lines, start);
  });

  it('ignores an update whose stock is not a whole number of at least zero', () => {
    const start: CartLines = [line({ quantity: 2, stock: 9 })];
    for (const stock of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.equal(applyStockRefresh(start, [{ productId: ID_A, stock }]).lines, start, String(stock));
    }
  });

  it('with two updates for one product the last one wins', () => {
    const result = applyStockRefresh([line({ quantity: 5, stock: 10 })], [
      { productId: ID_A, stock: 1 },
      { productId: ID_A, stock: 4 },
    ]);
    assert.equal(result.lines[0]?.quantity, 4);
  });

  it('reports one adjustment per affected line, in cart order', () => {
    const start = [
      line({ quantity: 4, stock: 9 }),
      line({ productId: ID_B, quantity: 1, stock: 9 }),
      line({ productId: ID_C, quantity: 6, stock: 9 }),
    ];
    const result = applyStockRefresh(start, [
      { productId: ID_C, stock: 2 },
      { productId: ID_B, stock: 0 },
      { productId: ID_A, stock: 4 },
    ]);

    assert.deepEqual(
      result.adjustments.map(({ productId, removed }) => [productId, removed]),
      [
        [ID_B, true],
        [ID_C, false],
      ],
    );
    assert.deepEqual(
      result.lines.map(({ productId, quantity, stock }) => [productId, quantity, stock]),
      [
        [ID_A, 4, 4],
        [ID_C, 2, 2],
      ],
    );
  });

  it('whatever the updates, every remaining line satisfies 1 <= quantity <= stock', () => {
    const start = [
      line({ quantity: 9, stock: 9 }),
      line({ productId: ID_B, quantity: 5, stock: 9 }),
      line({ productId: ID_C, quantity: 1, stock: 9 }),
    ];
    for (const stock of [0, 1, 2, 5, 9, 40]) {
      const { lines } = applyStockRefresh(start, [
        { productId: ID_A, stock },
        { productId: ID_B, stock },
        { productId: ID_C, stock },
      ]);
      for (const { quantity, stock: lineStock } of lines) {
        assert.ok(quantity >= 1 && quantity <= lineStock, `stock ${stock}: ${quantity}/${lineStock}`);
      }
    }
  });

  it('does not mutate the previous lines nor the updates', () => {
    const previous = deepFreeze([line({ quantity: 8, stock: 10 })]);
    const updates = deepFreeze([{ productId: ID_A, stock: 3 }]);

    applyStockRefresh(previous, updates);

    assert.equal(previous[0]?.quantity, 8);
    assert.equal(previous[0]?.stock, 10);
  });
});

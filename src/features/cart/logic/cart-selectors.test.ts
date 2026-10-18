/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { CurrencyCode } from '../../product/contracts/catalog-product.ts';
import { selectIsRehydrated } from '../../../core/store/rehydration.ts';
import type { CartLine } from './cart.ts';
import {
  selectCanCheckout,
  selectCartLines,
  selectCartUnits,
  selectDisplaySubtotal,
  selectDisplayCartLines,
  selectIsCartLocked,
  selectShippingProgress,
  selectSubtotalMxnCents,
} from './cart-selectors.ts';

function line(overrides: Partial<CartLine> = {}): CartLine {
  return {
    productId: 'product-261009-001',
    quantity: 1,
    name: 'Complete Daily Powder',
    unitPrice: 100,
    currency: 'MXN',
    stock: 99,
    ...overrides,
  };
}

/** The pieces of the root state the cart selectors read. */
function stateOf(
  lines: readonly CartLine[],
  currency: CurrencyCode = 'MXN',
  rehydrated = true,
) {
  return {
    cart: { lines },
    preferences: { currency },
    _persist: { version: 1, rehydrated },
  };
}

/** A cart whose subtotal is exactly this many canonical MXN cents (one line, quantity 1). */
const cartWorth = (mxnCents: number, currency: CurrencyCode = 'MXN') => [
  line({ unitPrice: mxnCents / 100, currency }),
];

describe('selectCartLines, selectCartUnits and selectSubtotalMxnCents', () => {
  it('read the lines of the slice and derive units and the canonical subtotal', () => {
    const lines = [
      line({ quantity: 2, unitPrice: 10 }),
      line({ productId: 'product-261009-002', quantity: 3, unitPrice: 1, currency: 'USD' }),
    ];
    const state = stateOf(lines);

    assert.equal(selectCartLines(state), lines);
    assert.equal(selectCartUnits(state), 5);
    assert.equal(selectSubtotalMxnCents(state), 2_000 + 5_400);
  });

  it('an empty cart: zero units and zero subtotal', () => {
    assert.equal(selectCartUnits(stateOf([])), 0);
    assert.equal(selectSubtotalMxnCents(stateOf([])), 0);
  });

  it('the canonical subtotal does not depend on the preferred currency', () => {
    const lines = [line({ unitPrice: 277.9 }), line({ productId: 'product-261009-002', unitPrice: 11.99, currency: 'USD' })];
    assert.equal(
      selectSubtotalMxnCents(stateOf(lines, 'MXN')),
      selectSubtotalMxnCents(stateOf(lines, 'USD')),
    );
  });
});

describe('selectDisplaySubtotal (view value in the preferred currency)', () => {
  it('shows the canonical subtotal as is in MXN', () => {
    assert.deepEqual(selectDisplaySubtotal(stateOf(cartWorth(27_790))), { cents: 27_790, currency: 'MXN' });
  });

  it('divides by 18 with half-up rounding in USD', () => {
    assert.deepEqual(selectDisplaySubtotal(stateOf(cartWorth(27_790), 'USD')), {
      cents: 1_544,
      currency: 'USD',
    });
  });

  it('returns the same object while its inputs are the same, a new one when they change', () => {
    const lines = cartWorth(10_000);
    const first = selectDisplaySubtotal(stateOf(lines));
    // A new state object (as after an unrelated action) with the same lines and currency.
    assert.equal(selectDisplaySubtotal(stateOf(lines)), first);
    assert.notEqual(selectDisplaySubtotal(stateOf(lines, 'USD')), first);
    assert.notEqual(selectDisplaySubtotal(stateOf(cartWorth(10_001), 'USD')), first);
  });
});

describe('selectDisplayCartLines (line totals derived from the snapshot)', () => {
  it('converts each complete line to the preferred currency without changing the cart', () => {
    const lines = [
      line({ quantity: 3, unitPrice: 149.9, currency: 'MXN' }),
      line({ productId: 'product-261009-002', quantity: 2, unitPrice: 9.99, currency: 'USD' }),
    ];
    const snapshot = structuredClone(lines);

    assert.deepEqual(selectDisplayCartLines(stateOf(lines, 'USD')), [
      { line: lines[0], unitCents: 833, totalCents: 2_498, currency: 'USD' },
      { line: lines[1], unitCents: 999, totalCents: 1_998, currency: 'USD' },
    ]);
    assert.deepEqual(lines, snapshot);
  });

  it('keeps the same result while lines and currency are unchanged', () => {
    const lines = [line({ quantity: 2 })];
    const first = selectDisplayCartLines(stateOf(lines));

    assert.equal(selectDisplayCartLines(stateOf(lines)), first);
    assert.notEqual(selectDisplayCartLines(stateOf([...lines])), first);
    assert.notEqual(selectDisplayCartLines(stateOf(lines, 'USD')), first);
  });
});

describe('selectShippingProgress (decided by the canonical MXN value, shown in the preferred currency)', () => {
  it('an empty cart has no progress and the whole threshold left', () => {
    assert.deepEqual(selectShippingProgress(stateOf([])), {
      qualifies: false,
      fraction: 0,
      thresholdCents: 80_000,
      remainingCents: 80_000,
      currency: 'MXN',
    });
    assert.deepEqual(selectShippingProgress(stateOf([], 'USD')), {
      qualifies: false,
      fraction: 0,
      thresholdCents: 4_444,
      remainingCents: 4_444,
      currency: 'USD',
    });
  });

  it('half way: half the fraction and the other half left', () => {
    const progress = selectShippingProgress(stateOf(cartWorth(40_000)));
    assert.equal(progress.fraction, 0.5);
    assert.equal(progress.remainingCents, 40_000);
    assert.equal(progress.qualifies, false);

    const usd = selectShippingProgress(stateOf(cartWorth(40_000), 'USD'));
    assert.equal(usd.fraction, 0.5);
    assert.equal(usd.remainingCents, 2_222); // 400 MXN = 22.22 USD
  });

  for (const currency of ['MXN', 'USD'] as const) {
    describe(`with the view in ${currency}`, () => {
      it('799.99 MXN does not qualify', () => {
        const progress = selectShippingProgress(stateOf(cartWorth(79_999), currency));
        assert.equal(progress.qualifies, false);
        assert.ok(progress.fraction < 1);
        assert.equal(progress.currency, currency);
      });

      it('exactly 800.00 MXN qualifies, with full progress and nothing left', () => {
        const progress = selectShippingProgress(stateOf(cartWorth(80_000), currency));
        assert.equal(progress.qualifies, true);
        assert.equal(progress.fraction, 1);
        assert.equal(progress.remainingCents, 0);
      });

      it('800.01 MXN qualifies and the fraction never exceeds 1', () => {
        const progress = selectShippingProgress(stateOf(cartWorth(80_001), currency));
        assert.equal(progress.qualifies, true);
        assert.equal(progress.fraction, 1);
        assert.equal(progress.remainingCents, 0);
      });
    });
  }

  it('while the threshold is not met, the remainder is never shown as zero (at least one cent)', () => {
    // 1 MXN cent short: 0.055 USD cents, which rounds to 0 but must not read "$0.00".
    const oneCentShort = selectShippingProgress(stateOf(cartWorth(79_999), 'USD'));
    assert.equal(oneCentShort.remainingCents, 1);
    assert.equal(oneCentShort.qualifies, false);

    // In MXN the remainder is the real 1 cent.
    assert.equal(selectShippingProgress(stateOf(cartWorth(79_999), 'MXN')).remainingCents, 1);
  });

  it('the decision comes from the canonical value, not from the rounded view', () => {
    // 44.44 USD shows the same figure as the threshold in the USD view (4 444 cents), but it is
    // only 799.92 MXN: not qualified, with a remainder that still reads at least one cent.
    const short = selectShippingProgress(stateOf([line({ unitPrice: 44.44, currency: 'USD' })], 'USD'));
    assert.equal(short.thresholdCents, 4_444);
    assert.equal(short.qualifies, false);
    assert.equal(short.remainingCents, 1);

    // 44.45 USD is 800.10 MXN: qualified.
    const enough = selectShippingProgress(stateOf([line({ unitPrice: 44.45, currency: 'USD' })], 'USD'));
    assert.equal(enough.qualifies, true);
    assert.equal(enough.remainingCents, 0);
  });

  it('switching the view changes only the figures, never the verdict', () => {
    for (const mxnCents of [0, 1, 79_991, 79_999, 80_000, 80_001, 123_456]) {
      const inMxn = selectShippingProgress(stateOf(cartWorth(mxnCents), 'MXN'));
      const inUsd = selectShippingProgress(stateOf(cartWorth(mxnCents), 'USD'));
      assert.equal(inMxn.qualifies, inUsd.qualifies, String(mxnCents));
      assert.equal(inMxn.fraction, inUsd.fraction, String(mxnCents));
    }
  });

  it('is memoized: same inputs, same object; a new subtotal or currency, a new one', () => {
    const lines = cartWorth(50_000);
    const first = selectShippingProgress(stateOf(lines));

    assert.equal(selectShippingProgress(stateOf(lines)), first);
    assert.equal(selectShippingProgress(stateOf([...lines])), first); // same value, new array
    assert.notEqual(selectShippingProgress(stateOf(lines, 'USD')), first);
    assert.notEqual(selectShippingProgress(stateOf(cartWorth(50_001))), first);
  });
});

describe('selectIsRehydrated and selectIsCartLocked (RF-11)', () => {
  it('reads the redux-persist marker', () => {
    assert.equal(selectIsRehydrated({ _persist: { version: 1, rehydrated: true } }), true);
    assert.equal(selectIsRehydrated({ _persist: { version: 1, rehydrated: false } }), false);
  });

  it('the cart is locked while the state is rehydrating', () => {
    assert.equal(selectIsCartLocked({ _persist: { version: 1, rehydrated: false } }), true);
  });

  it('the cart is free once rehydrated (on T2 nothing else locks it)', () => {
    assert.equal(selectIsCartLocked({ _persist: { version: 1, rehydrated: true } }), false);
  });
});

describe('selectCanCheckout (RF-10, RF-11)', () => {
  it('is false for an empty cart', () => {
    assert.equal(selectCanCheckout(stateOf([])), false);
  });

  it('is true with products once rehydrated', () => {
    assert.equal(selectCanCheckout(stateOf([line()])), true);
  });

  it('is false while rehydrating, even if the lines are already there', () => {
  assert.equal(selectCanCheckout(stateOf([line()], 'MXN', false)), false);
  assert.equal(selectCanCheckout({ ...stateOf([line()]), checkoutAttempt: { status: 'preliminary', key: 'k', fingerprint: 'f' } } as never), false);
  assert.equal(selectIsCartLocked({ ...stateOf([line()]), checkoutAttempt: { status: 'unresolved', key: 'k', fingerprint: 'f' } } as never), true);
});
});

// T2 (RF-3). The 800 MXN threshold with real carts (several lines, quantities, mixed currencies)
// instead of one synthetic line, and zero/decimal amounts through the whole chain.
describe('free shipping on realistic carts (table)', () => {
  type Case = readonly [label: string, lines: readonly CartLine[], qualifies: boolean, subtotalMxnCents: number];
  const a = 'product-261009-001';
  const b = 'product-261009-002';
  const c = 'product-261009-003';

  const cases: readonly Case[] = [
    ['8 x 100 MXN = exactly 800', [line({ quantity: 8, unitPrice: 100 })], true, 80_000],
    ['7 x 100 + 99.99 MXN = 799.99', [line({ quantity: 7, unitPrice: 100 }), line({ productId: b, unitPrice: 99.99 })], false, 79_999],
    ['400 MXN + 22.22 USD (= 399.96 MXN) = 799.96', [line({ unitPrice: 400 }), line({ productId: b, unitPrice: 22.22, currency: 'USD' })], false, 79_996],
    ['400 MXN + 22.23 USD (= 400.14 MXN) = 800.14', [line({ unitPrice: 400 }), line({ productId: b, unitPrice: 22.23, currency: 'USD' })], true, 80_014],
    ['three lines of 266.67 MXN = 800.01', [line({ unitPrice: 266.67 }), line({ productId: b, unitPrice: 266.67 }), line({ productId: c, unitPrice: 266.67 })], true, 80_001],
    ['3 x 0.1 MXN keeps cents exact (30, not 30.000000000000004)', [line({ quantity: 3, unitPrice: 0.1 })], false, 30],
    ['a free product (0 MXN) adds nothing', [line({ unitPrice: 800 }), line({ productId: b, unitPrice: 0, quantity: 5 })], true, 80_000],
    ['only free products', [line({ unitPrice: 0, quantity: 3 })], false, 0],
    ['empty cart', [], false, 0],
    ['stock never changes the money', [line({ quantity: 2, unitPrice: 400, stock: 2 })], true, 80_000],
    ['same total split across 4 lines', [a, b, c, 'product-261009-004'].map((productId) => line({ productId, unitPrice: 200 })), true, 80_000],
  ];

  for (const [label, lines, qualifies, subtotal] of cases) {
    for (const currency of ['MXN', 'USD'] as const) {
      it(`${label}, view ${currency}`, () => {
        const state = stateOf(lines, currency);
        assert.equal(selectSubtotalMxnCents(state), subtotal);
        assert.equal(selectShippingProgress(state).qualifies, qualifies);
        assert.equal(selectShippingProgress(state).remainingCents === 0, qualifies);
      });
    }
  }
});

describe('zero and decimal amounts in the display chain', () => {
  it('a zero-priced line shows 0 in both views, and so does the subtotal', () => {
    const lines = [line({ unitPrice: 0, quantity: 3 })];
    for (const currency of ['MXN', 'USD'] as const) {
      assert.deepEqual(selectDisplaySubtotal(stateOf(lines, currency)), { cents: 0, currency });
      const [only] = selectDisplayCartLines(stateOf(lines, currency));
      assert.equal(only?.unitCents, 0);
      assert.equal(only?.totalCents, 0);
    }
  });

  it('the line total converts the whole line: 3 x 0.07 USD is 21 cents, not 3 x a rounded unit', () => {
    const [only] = selectDisplayCartLines(stateOf([line({ unitPrice: 0.07, currency: 'USD', quantity: 3 })], 'USD'));
    assert.equal(only?.unitCents, 7);
    assert.equal(only?.totalCents, 21);

    // 1 MXN cent in USD rounds to 0, but 90 of them (a whole line) are 5 USD cents.
    const [tiny] = selectDisplayCartLines(stateOf([line({ unitPrice: 0.01, currency: 'MXN', quantity: 90 })], 'USD'));
    assert.equal(tiny?.unitCents, 0);
    assert.equal(tiny?.totalCents, 5);
  });

  it('the subtotal is the sum of canonical lines, which can differ from the sum of displayed totals', () => {
    // Two lines of 0.01 MXN x 9: each displays 1 USD cent (9 MXN cents -> 0.5 -> 1), but together
    // they are 18 MXN cents = exactly 1 USD cent. The subtotal follows the canonical value.
    const lines = [line({ unitPrice: 0.01, quantity: 9 }), line({ productId: 'product-261009-002', unitPrice: 0.01, quantity: 9 })];
    const state = stateOf(lines, 'USD');
    assert.equal(selectSubtotalMxnCents(state), 18);
    assert.equal(selectDisplaySubtotal(state).cents, 1);
    assert.deepEqual(selectDisplayCartLines(state).map((row) => row.totalCents), [1, 1]);
  });

  it('changing the preferred currency leaves the cart and its canonical subtotal untouched', () => {
    const lines = [line({ unitPrice: 277.9, quantity: 2 }), line({ productId: 'product-261009-002', unitPrice: 11.99, currency: 'USD' })];
    const before = structuredClone(lines);
    const mxn = selectSubtotalMxnCents(stateOf(lines, 'MXN'));
    selectDisplaySubtotal(stateOf(lines, 'USD'));
    selectDisplayCartLines(stateOf(lines, 'USD'));
    assert.equal(selectSubtotalMxnCents(stateOf(lines, 'USD')), mxn);
    assert.deepEqual(lines, before);
  });
});

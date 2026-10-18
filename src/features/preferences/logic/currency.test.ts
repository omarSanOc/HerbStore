/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  FREE_SHIPPING_THRESHOLD_MXN_CENTS,
  formatMoney,
  fromMxnCents,
  isCurrencyCode,
  MXN_PER_USD,
  toDisplayCents,
  toMxnCents,
} from './currency.ts';

// ICU may separate symbol and amount with a no-break space: compare with a plain one.
const plain = (text: string) => text.replace(/[\u00a0\u202f]/g, ' ');

describe('constants (spec 004: 1 USD = 18 MXN, free shipping from 800 MXN)', () => {
  it('uses the fixed rate and the threshold in whole MXN cents', () => {
    assert.equal(MXN_PER_USD, 18);
    assert.equal(FREE_SHIPPING_THRESHOLD_MXN_CENTS, 80_000);
  });
});

describe('isCurrencyCode', () => {
  it('accepts only the two supported codes, exactly', () => {
    assert.equal(isCurrencyCode('MXN'), true);
    assert.equal(isCurrencyCode('USD'), true);
    for (const value of ['mxn', 'usd', 'EUR', '', ' MXN', undefined, null, 1, {}, ['MXN']]) {
      assert.equal(isCurrencyCode(value), false);
    }
  });
});

describe('toMxnCents (canonical value: whole MXN cents)', () => {
  it('turns a MXN amount into whole cents', () => {
    assert.equal(toMxnCents(277.9, 'MXN'), 27_790);
    assert.equal(toMxnCents(0, 'MXN'), 0);
    assert.equal(toMxnCents(800, 'MXN'), 80_000);
  });

  it('multiplies a USD amount by 18 after taking it to whole cents', () => {
    assert.equal(toMxnCents(1, 'USD'), 1_800);
    assert.equal(toMxnCents(11.99, 'USD'), 21_582);
    assert.equal(toMxnCents(0.01, 'USD'), 18);
  });

  it('absorbs binary floating point error: the result is always an integer', () => {
    // 0.1 + 0.2 is 0.30000000000000004 and 1.15 * 100 is 114.99999999999999.
    assert.equal(toMxnCents(0.1 + 0.2, 'MXN'), 30);
    assert.equal(toMxnCents(1.15, 'MXN'), 115);
    for (const amount of [19.99, 0.07, 1234.56, 799.99, 800.01]) {
      assert.equal(Number.isInteger(toMxnCents(amount, 'MXN')), true, String(amount));
      assert.equal(Number.isInteger(toMxnCents(amount, 'USD')), true, String(amount));
    }
  });
});

describe('fromMxnCents (view value, half-up rounding for USD)', () => {
  it('keeps MXN cents as they are', () => {
    assert.equal(fromMxnCents(27_790, 'MXN'), 27_790);
    assert.equal(fromMxnCents(0, 'MXN'), 0);
  });

  it('divides by 18 and rounds half up to the cent', () => {
    assert.equal(fromMxnCents(0, 'USD'), 0);
    assert.equal(fromMxnCents(8, 'USD'), 0); // 0.444... cents
    assert.equal(fromMxnCents(9, 'USD'), 1); // exactly 0.5 goes up
    assert.equal(fromMxnCents(26, 'USD'), 1); // 1.444...
    assert.equal(fromMxnCents(27, 'USD'), 2); // exactly 1.5 goes up
    assert.equal(fromMxnCents(1_800, 'USD'), 100);
    assert.equal(fromMxnCents(80_000, 'USD'), 4_444); // 4444.44...
  });
});

describe('round trip between currencies', () => {
  it('USD -> MXN -> USD is exact for every cent amount', () => {
    for (let usdCents = 0; usdCents <= 200_000; usdCents += 1) {
      assert.equal(fromMxnCents(toMxnCents(usdCents / 100, 'USD'), 'USD'), usdCents);
    }
  });

  it('MXN -> USD -> MXN loses at most half a USD cent (9 MXN cents), never more', () => {
    for (let mxnCents = 0; mxnCents <= 100_000; mxnCents += 1) {
      const usdCents = fromMxnCents(mxnCents, 'USD');
      const back = toMxnCents(usdCents / 100, 'USD');
      assert.ok(Math.abs(back - mxnCents) <= 9, `${mxnCents} -> ${usdCents} -> ${back}`);
    }
  });

  it('MXN -> MXN is the identity', () => {
    assert.equal(fromMxnCents(toMxnCents(277.9, 'MXN'), 'MXN'), 27_790);
  });
});

describe('toDisplayCents (an amount in its own currency, shown in the preferred one)', () => {
  it('does not round when the currency is the same', () => {
    assert.equal(toDisplayCents(277.9, 'MXN', 'MXN'), 27_790);
    assert.equal(toDisplayCents(11.99, 'USD', 'USD'), 1_199);
  });

  it('converts through the canonical MXN value', () => {
    assert.equal(toDisplayCents(277.9, 'MXN', 'USD'), 1_544); // 27790 / 18 = 1543.88...
    assert.equal(toDisplayCents(11.99, 'USD', 'MXN'), 21_582);
  });
});

describe('formatMoney (Intl.NumberFormat is the last step)', () => {
  it('formats whole cents in the given currency and language', () => {
    assert.equal(plain(formatMoney(27_790, 'MXN', 'es')), '$277.90');
    assert.equal(plain(formatMoney(27_790, 'MXN', 'en')), 'MX$277.90');
    assert.equal(plain(formatMoney(4_444, 'USD', 'en')), '$44.44');
    assert.equal(plain(formatMoney(4_444, 'USD', 'es')), 'USD 44.44');
  });

  it('keeps two decimals, groups thousands and shows a lone cent', () => {
    assert.equal(plain(formatMoney(123_456_789, 'MXN', 'es')), '$1,234,567.89');
    assert.equal(plain(formatMoney(0, 'USD', 'en')), '$0.00');
    assert.equal(plain(formatMoney(1, 'USD', 'en')), '$0.01');
  });
});

// T2 (RF-3). Zero, tiny and awkward decimal amounts, as a table: input -> canonical MXN cents.
describe('zero and decimal amounts (table)', () => {
  const cases: readonly (readonly [amount: number, currency: 'MXN' | 'USD', mxnCents: number])[] = [
    [0, 'MXN', 0],
    [0, 'USD', 0],
    [0.01, 'MXN', 1],
    [0.01, 'USD', 18],
    [0.1, 'MXN', 10],
    [0.29, 'MXN', 29], // 0.29 * 100 = 28.999999999999996
    [19.99, 'USD', 35_982],
    [799.99, 'MXN', 79_999],
    [800, 'MXN', 80_000],
    [800.01, 'MXN', 80_001],
    [44.44, 'USD', 79_992],
    [44.45, 'USD', 80_010],
    [1234.56, 'MXN', 123_456],
  ];

  for (const [amount, currency, expected] of cases) {
    it(`${amount} ${currency} is ${expected} canonical MXN cents`, () => {
      const actual = toMxnCents(amount, currency);
      assert.equal(actual, expected);
      assert.equal(Number.isInteger(actual), true);
    });
  }

  it('zero is zero in every view and format', () => {
    for (const view of ['MXN', 'USD'] as const) {
      assert.equal(fromMxnCents(0, view), 0);
      for (const language of ['es', 'en']) assert.match(plain(formatMoney(0, view, language)), /0\.00$/);
    }
  });
});

// T2 (RF-3, RF-8 groundwork). Language and currency are independent axes: changing both at once
// changes only the TEXT of an amount; the canonical value and the view cents do not depend on the
// language. 2 x 2 matrix over one canonical amount.
describe('language x currency (simultaneous change)', () => {
  const canonical = 123_456; // 1,234.56 MXN

  const expected: Readonly<Record<string, string>> = {
    'es MXN': '$1,234.56',
    'en MXN': 'MX$1,234.56',
    'es USD': 'USD 68.59', // 123456 / 18 = 6858.67 -> 6859 cents
    'en USD': '$68.59',
  };

  for (const language of ['es', 'en']) {
    for (const currency of ['MXN', 'USD'] as const) {
      it(`${language} + ${currency}: ${expected[`${language} ${currency}`]}`, () => {
        const cents = fromMxnCents(canonical, currency);
        assert.equal(plain(formatMoney(cents, currency, language)), expected[`${language} ${currency}`]);
      });
    }
  }

  it('the view cents depend only on the currency; the language never changes the number', () => {
    for (const currency of ['MXN', 'USD'] as const) {
      const digits = ['es', 'en'].map((language) => plain(formatMoney(fromMxnCents(canonical, currency), currency, language)).replace(/[^\d.]/g, ''));
      assert.equal(digits[0], digits[1], currency);
    }
  });
});

/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { CurrencyCode, OrderSummary } from '../../checkout/contracts/order.ts';
import { formatMoney, toMxnCents } from '../../preferences/logic/currency.ts';
import { buildOrderHistoryRows } from './order-history-view.ts';

// RF-11 (T4b). Pure transformation of the persisted `orderHistory` into what "My orders" draws:
// newest first, units, the total in the PREFERRED currency (canonical value untouched) and a local
// date. No address anywhere: the summary does not have one, and the rows are built field by field.

const order = (id: string, createdAt: string, extra: Partial<OrderSummary> = {}): OrderSummary => ({
  id,
  items: [{ productId: 'product-261009-001', quantity: 1, unitPrice: 100, lineTotal: 100 }],
  currency: 'MXN',
  subtotal: 100,
  shipping: 99,
  total: 199,
  createdAt,
  ...extra,
});

const view = (orders: readonly OrderSummary[], currency: CurrencyCode = 'MXN', language = 'es') =>
  buildOrderHistoryRows(orders, { currency, language, timeZone: 'UTC' });

/** Freezes recursively: a transformation that writes to its input throws in strict mode. */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

describe('order of the list', () => {
  it('shows the most recent order first, whatever order they were stored in', () => {
    const rows = view([
      order('b-middle', '2026-10-02T10:00:00.000Z'),
      order('a-oldest', '2026-10-01T10:00:00.000Z'),
      order('c-newest', '2026-10-03T10:00:00.000Z'),
    ]);
    assert.deepEqual(rows.map((row) => row.id), ['c-newest', 'b-middle', 'a-oldest']);
  });

  it('breaks a tie on the same instant with the order recorded later first', () => {
    const rows = view([order('first', '2026-10-01T10:00:00.000Z'), order('second', '2026-10-01T10:00:00.000Z')]);
    assert.deepEqual(rows.map((row) => row.id), ['second', 'first']);
  });

  it('puts an order whose date cannot be read after the dated ones, newest recorded first, and still lists it', () => {
    const rows = view([
      order('undated-1', 'garbage'),
      order('dated', '2026-10-01T10:00:00.000Z'),
      order('undated-2', ''),
    ]);
    assert.deepEqual(rows.map((row) => row.id), ['dated', 'undated-2', 'undated-1']);
    assert.equal(rows[1]?.dateText, undefined);
  });

  it('compares instants, not text: an offset date and a Z date order by the moment they name', () => {
    const rows = view([order('earlier', '2026-10-01T12:00:00.000+05:00'), order('later', '2026-10-01T09:00:00.000Z')]);
    assert.deepEqual(rows.map((row) => row.id), ['later', 'earlier']);
  });

  it('an empty history is an empty list', () => {
    assert.deepEqual(view([]), []);
  });
});

describe('units', () => {
  it('adds the quantity of every line', () => {
    const rows = view([order('o', '2026-10-01T10:00:00.000Z', { items: [
      { productId: 'a', quantity: 1, unitPrice: 1, lineTotal: 1 },
      { productId: 'b', quantity: 2, unitPrice: 1, lineTotal: 2 },
      { productId: 'c', quantity: 99, unitPrice: 1, lineTotal: 99 },
    ] })]);
    assert.equal(rows[0]?.unitCount, 102);
  });

  it('ignores a stored quantity that is not a positive whole number instead of showing NaN', () => {
    const items = [
      { productId: 'a', quantity: 3, unitPrice: 1, lineTotal: 1 },
      { productId: 'b', quantity: '2', unitPrice: 1, lineTotal: 1 },
      { productId: 'c', quantity: -1, unitPrice: 1, lineTotal: 1 },
      { productId: 'd', quantity: 1.5, unitPrice: 1, lineTotal: 1 },
    ] as unknown as OrderSummary['items'];
    assert.equal(view([order('o', '2026-10-01T10:00:00.000Z', { items })])[0]?.unitCount, 3);
  });
});

describe('total in the preferred currency', () => {
  // `cents` are whole cents of the currency it is shown in; `formatMoney` (tested on its own) writes them.
  const cases: readonly Readonly<{ label: string; total: number; from: CurrencyCode; to: CurrencyCode; cents: number }>[] = [
    { label: 'MXN order shown in MXN', total: 299, from: 'MXN', to: 'MXN', cents: 29_900 },
    { label: 'MXN order shown in USD (299 / 18 = 16.61, rounded half up to the cent)', total: 299, from: 'MXN', to: 'USD', cents: 1_661 },
    { label: 'USD order shown in MXN (12.99 x 18 = 233.82)', total: 12.99, from: 'USD', to: 'MXN', cents: 23_382 },
    { label: 'USD order shown in USD is not converted at all', total: 12.99, from: 'USD', to: 'USD', cents: 1_299 },
    { label: 'zero', total: 0, from: 'MXN', to: 'USD', cents: 0 },
    { label: 'decimals of an MXN order', total: 277.9, from: 'MXN', to: 'MXN', cents: 27_790 },
  ];

  for (const language of ['es', 'en']) {
    for (const { label, total, from, to, cents } of cases) {
      it(`${language}: ${label}`, () => {
        const rows = view([order('o', '2026-10-01T10:00:00.000Z', { currency: from, total })], to, language);
        assert.equal(rows[0]?.totalText, formatMoney(cents, to, language));
      });
    }
  }

  it('the preferred currency is the one the row is shown in', () => {
    const [row] = view([order('o', '2026-10-01T10:00:00.000Z', { currency: 'MXN', total: 299 })], 'USD', 'en');
    assert.equal(row?.displayCurrency, 'USD');
    const [mxn] = view([order('o', '2026-10-01T10:00:00.000Z', { currency: 'MXN', total: 299 })], 'MXN', 'en');
    assert.equal(mxn?.displayCurrency, 'MXN');
  });

  it('keeps the CANONICAL value (MXN cents) whatever currency is shown, and never touches the stored order', () => {
    const stored = deepFreeze([order('o', '2026-10-01T10:00:00.000Z', { currency: 'USD', total: 12.99 })]);
    const canonical = toMxnCents(12.99, 'USD');

    assert.equal(view(stored, 'MXN')[0]?.canonicalMxnCents, canonical);
    assert.equal(view(stored, 'USD')[0]?.canonicalMxnCents, canonical);
    assert.equal(stored[0]?.total, 12.99);
    assert.equal(stored[0]?.currency, 'USD');
  });

  it('switching currency and language together uses the final preference, in one pass', () => {
    const stored = [order('o', '2026-10-01T10:00:00.000Z', { total: 299 })];
    const first = view(stored, 'MXN', 'es')[0];
    const second = view(stored, 'USD', 'en')[0];
    assert.notEqual(first?.totalText, second?.totalText);
    assert.equal(first?.canonicalMxnCents, second?.canonicalMxnCents);
  });
});

describe('date', () => {
  it('is written in the interface language and carries the day', () => {
    const [spanish] = view([order('o', '2026-10-15T10:30:00.000Z')], 'MXN', 'es');
    const [english] = view([order('o', '2026-10-15T10:30:00.000Z')], 'MXN', 'en');
    assert.match(spanish?.dateText ?? '', /oct/i);
    assert.match(english?.dateText ?? '', /Oct/);
    assert.match(spanish?.dateText ?? '', /2026/);
  });
});

describe('privacy (RF-11: never the address)', () => {
  it('builds each row field by field: an address, a name or a phone that slipped into the stored object cannot reach the row', () => {
    const polluted = {
      ...order('o', '2026-10-01T10:00:00.000Z'),
      shippingAddress: { fullName: 'Ana Perez', phone: '5512345678', street: 'Avenida Central' },
      fullName: 'Ana Perez',
    } as unknown as OrderSummary;

    const text = JSON.stringify(view([polluted]));

    for (const secret of ['Ana Perez', '5512345678', 'Avenida Central', 'shippingAddress', 'fullName']) {
      assert.equal(text.includes(secret), false, secret);
    }
    assert.deepEqual(Object.keys(view([polluted])[0] ?? {}).sort(), [
      'canonicalMxnCents',
      'dateText',
      'displayCurrency',
      'id',
      'totalText',
      'unitCount',
    ]);
  });
});

describe('purity', () => {
  it('does not mutate its input nor reuse the array', () => {
    const stored = deepFreeze([order('a', '2026-10-01T10:00:00.000Z'), order('b', '2026-10-02T10:00:00.000Z')]);
    const rows = view(stored);
    assert.notEqual(rows as unknown, stored as unknown);
    assert.deepEqual(stored.map((entry) => entry.id), ['a', 'b']);
  });
});

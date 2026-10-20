/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { homeData, wirePayload } from '../testing/home-test-data.ts';
import { parseHomePayload } from './parse-home.ts';

type Mutable = Record<string, any>;

/** Applies `change` to a fresh copy of the wire payload. */
function broken(change: (payload: Mutable) => void): unknown {
  const payload = wirePayload() as Mutable;
  change(payload);
  return payload;
}

describe('parseHomePayload: valid payloads', () => {
  it('projects the real wire shape onto HomeData, dropping fields Home does not use', () => {
    assert.deepEqual(parseHomePayload(wirePayload()), homeData());
  });

  it('omits optional fields that are absent instead of keeping undefined keys', () => {
    const data = parseHomePayload(wirePayload());
    const first = data?.sections[0]?.items[0];

    assert.ok(first);
    assert.equal('listPrice' in first, false);
    assert.equal('couponText' in first, false);
  });

  it('accepts empty collections (omitting them is the screen state, not a contract error)', () => {
    const data = parseHomePayload({ banners: [], categories: [], sections: [] });

    assert.deepEqual(data, { banners: [], categories: [], sections: [] });
  });

  it('accepts a section without items', () => {
    const data = parseHomePayload(
      broken((payload) => {
        payload.sections[1].items = [];
      }),
    );

    assert.deepEqual(data?.sections[1], { id: 'new', title: 'New', items: [] });
  });

  it('ignores sections it does not know and badges it does not know', () => {
    const data = parseHomePayload(
      broken((payload) => {
        payload.sections.push({ id: 'seasonal', title: 'Seasonal', items: [] });
        payload.sections[0].items[0].badges = ['NEW', 'FUTURE_BADGE'];
      }),
    );

    assert.deepEqual(
      data?.sections.map(({ id }) => id),
      ['best_sellers', 'new', 'offers'],
    );
    assert.deepEqual(data?.sections[0]?.items[0]?.badges, ['NEW']);
  });

  it('does not alias the input: mutating the payload later cannot change the result', () => {
    const payload = wirePayload() as Mutable;
    const data = parseHomePayload(payload);
    payload.banners[0].title = 'changed';
    payload.sections[0].items[0].images.push('/x.png');

    assert.equal(data?.banners[0]?.title, 'Daily wellness essentials');
    assert.equal(data?.sections[0]?.items[0]?.images.length, 2);
  });
});

describe('parseHomePayload: invalid payloads', () => {
  const cases: [string, unknown][] = [
    ['undefined', undefined],
    ['null', null],
    ['a string', 'home'],
    ['an array', []],
    ['an error envelope', { error: { code: 'SIMULATED_FAILURE', message: 'x' } }],
    ['no banners key', broken((p) => delete p.banners)],
    ['banners not an array', broken((p) => (p.banners = {}))],
    ['categories null', broken((p) => (p.categories = null))],
    ['sections missing', broken((p) => delete p.sections)],
    ['banner without id', broken((p) => delete p.banners[0].id)],
    ['banner with empty title', broken((p) => (p.banners[0].title = ''))],
    ['banner imageUrl not a string', broken((p) => (p.banners[0].imageUrl = 5))],
    ['banner without categoryId', broken((p) => delete p.banners[0].categoryId)],
    ['duplicate banner ids', broken((p) => (p.banners[1].id = p.banners[0].id))],
    ['category with negative productCount', broken((p) => (p.categories[0].productCount = -1))],
    ['category with fractional productCount', broken((p) => (p.categories[0].productCount = 1.5))],
    ['category without name', broken((p) => delete p.categories[0].name)],
    ['duplicate category ids', broken((p) => (p.categories[1].id = p.categories[0].id))],
    ['section items not an array', broken((p) => (p.sections[0].items = 'none'))],
    ['section without title', broken((p) => delete p.sections[0].title)],
    ['duplicate known section ids', broken((p) => (p.sections[1].id = 'best_sellers'))],
    [
      'duplicate product ids in a section',
      broken((p) => (p.sections[0].items[1].id = p.sections[0].items[0].id)),
    ],
    ['price as a string', broken((p) => (p.sections[0].items[0].price = '12.99'))],
    ['negative price', broken((p) => (p.sections[0].items[0].price = -1))],
    ['listPrice null', broken((p) => (p.sections[0].items[0].listPrice = null))],
    ['unknown currency', broken((p) => (p.sections[0].items[0].currency = 'EUR'))],
    ['rating above 5', broken((p) => (p.sections[0].items[0].rating = 5.1))],
    ['negative reviewCount', broken((p) => (p.sections[0].items[0].reviewCount = -3))],
    ['inStock as a string', broken((p) => (p.sections[0].items[0].inStock = 'yes'))],
    ['badges not an array', broken((p) => (p.sections[0].items[0].badges = 'NEW'))],
    ['images not an array', broken((p) => (p.sections[0].items[0].images = '/a.png'))],
    ['image path not a string', broken((p) => (p.sections[0].items[0].images = [1]))],
    ['product as null', broken((p) => (p.sections[0].items[0] = null))],
    ['couponText not a string', broken((p) => (p.sections[2].items[0].couponText = 10))],
  ];

  for (const [label, payload] of cases) {
    it(`returns undefined for ${label}`, () => {
      assert.equal(parseHomePayload(payload), undefined);
    });
  }
});

// The same property with our own immutable fixture: whatever the payload holds, the parser keeps
// every banner, category, section and item with its ids, prices and currency (RF-8). What the
// real API serves is checked by the opt-in live smoke, not by the unit suite (RF-41).
describe('parseHomePayload keeps the whole payload', () => {
  it('keeps every banner, category, section and product', () => {
    const wire = wirePayload() as Mutable;

    const data = parseHomePayload(wire);

    assert.ok(data);
    assert.equal(data.banners.length, wire.banners.length);
    assert.equal(data.categories.length, wire.categories.length);
    assert.deepEqual(
      data.sections.map(({ id, items }) => [id, items.length]),
      wire.sections.map(({ id, items }: Mutable) => [id, items.length]),
    );
    assert.deepEqual(
      data.sections.flatMap(({ items }) =>
        items.map(({ id, price, currency }) => [id, price, currency]),
      ),
      wire.sections.flatMap(({ items }: Mutable) =>
        items.map(({ id, price, currency }: Mutable) => [id, price, currency]),
      ),
    );
  });
});

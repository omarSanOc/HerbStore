/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { HomeData } from '../contracts/home.ts';
import { homeData } from '../testing/home-test-data.ts';
import { buildHomeRows } from './build-home-rows.ts';
import type { HomeScreenState } from './classify-home-result.ts';

const keysOf = (state: HomeScreenState) => buildHomeRows(state).map((row) => row.key);

const ready = (data: HomeData, notice?: 'offline' | 'update-failed'): HomeScreenState =>
  notice === undefined ? { status: 'ready', data } : { status: 'ready', data, notice };

describe('buildHomeRows: ready', () => {
  it('lists banners, categories and one row per section, in server order', () => {
    assert.deepEqual(keysOf(ready(homeData())), [
      'banners',
      'categories',
      'section:best_sellers',
      'section:new',
      'section:offers',
    ]);
  });

  it('carries each collection in its row', () => {
    const data = homeData();
    const rows = buildHomeRows(ready(data));

    assert.deepEqual(rows[0], { key: 'banners', kind: 'banners', banners: data.banners });
    assert.deepEqual(rows[1], { key: 'categories', kind: 'categories', categories: data.categories });
    assert.deepEqual(rows[2], {
      key: 'section:best_sellers',
      kind: 'section',
      section: data.sections[0],
    });
  });

  it('omits only the empty collections', () => {
    assert.deepEqual(keysOf(ready({ ...homeData(), banners: [] })), [
      'categories',
      'section:best_sellers',
      'section:new',
      'section:offers',
    ]);
    assert.deepEqual(keysOf(ready({ ...homeData(), categories: [] })).slice(0, 2), [
      'banners',
      'section:best_sellers',
    ]);
    assert.deepEqual(
      keysOf(
        ready({
          ...homeData(),
          sections: homeData().sections.filter(({ id }) => id !== 'new'),
        }),
      ),
      ['banners', 'categories', 'section:best_sellers', 'section:offers'],
    );
  });

  it('puts the notice first, above the content', () => {
    assert.deepEqual(keysOf(ready(homeData(), 'offline')).slice(0, 2), ['notice', 'banners']);
    const [notice] = buildHomeRows(ready(homeData(), 'update-failed'));
    assert.deepEqual(notice, { key: 'notice', kind: 'notice', notice: 'update-failed' });
  });

  it('has no notice row without a notice', () => {
    assert.equal(keysOf(ready(homeData())).includes('notice'), false);
  });
});

describe('buildHomeRows: other states', () => {
  it('loading is a single skeleton row', () => {
    assert.deepEqual(buildHomeRows({ status: 'loading' }), [
      { key: 'loading', kind: 'loading' },
    ]);
  });

  it('empty, offline and error are each a single status row', () => {
    for (const status of ['empty', 'offline', 'error'] as const) {
      assert.deepEqual(buildHomeRows({ status }), [
        { key: status, kind: 'status', status },
      ]);
    }
  });
});

describe('buildHomeRows: keys', () => {
  it('are unique and do not depend on the position', () => {
    const keys = keysOf(ready(homeData(), 'offline'));

    assert.equal(new Set(keys).size, keys.length);
    // Dropping a row must not rename the others (stable keys keep the rows' identity).
    const without = keysOf(ready({ ...homeData(), banners: [] }, 'offline'));
    assert.deepEqual(
      without,
      keys.filter((key) => key !== 'banners'),
    );
  });

  it('does not mutate the state it receives', () => {
    const state = ready(homeData(), 'offline');
    const snapshot = structuredClone(state);

    buildHomeRows(state);

    assert.deepEqual(state, snapshot);
  });
});

/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { FetchJsonOutcome } from '../../../core/network/http.ts';
import type { HomeData } from '../contracts/home.ts';
import { homeData } from '../testing/home-test-data.ts';
import { classifyHomeResult } from './classify-home-result.ts';

type Outcome = FetchJsonOutcome<HomeData>;

const ok = (data: HomeData): Outcome => ({ kind: 'ok', data, status: 200 });
const withoutItems = (data: HomeData, id: string): HomeData => ({
  ...data,
  sections: data.sections.map((section) => (section.id === id ? { ...section, items: [] } : section)),
});
const allEmpty: HomeData = { banners: [], categories: [], sections: [] };

describe('classifyHomeResult: waiting', () => {
  it('is loading without previous data while the request is pending', () => {
    assert.deepEqual(classifyHomeResult(undefined, undefined), { status: 'loading' });
  });

  it('keeps showing the previous data while a refetch is pending, with no notice', () => {
    const previous = homeData();

    assert.deepEqual(classifyHomeResult(previous, undefined), { status: 'ready', data: previous });
  });

  it('treats an aborted request like a pending one (the caller discards it)', () => {
    assert.deepEqual(classifyHomeResult(undefined, { kind: 'aborted' }), { status: 'loading' });
    const previous = homeData();
    assert.deepEqual(classifyHomeResult(previous, { kind: 'aborted' }), {
      status: 'ready',
      data: previous,
    });
  });
});

describe('classifyHomeResult: success', () => {
  it('is ready with the data, without a notice', () => {
    const data = homeData();

    assert.deepEqual(classifyHomeResult(undefined, ok(data)), { status: 'ready', data });
  });

  it('a fresh success replaces the previous data and clears any notice', () => {
    const previous = homeData();
    const fresh = { ...homeData(), banners: [] };

    assert.deepEqual(classifyHomeResult(previous, ok(fresh)), { status: 'ready', data: fresh });
  });

  it('omits only the empty collection: no banners', () => {
    const data = { ...homeData(), banners: [] };
    const state = classifyHomeResult(undefined, ok(data));

    assert.equal(state.status, 'ready');
    assert.deepEqual(state.status === 'ready' && state.data.banners, []);
    assert.equal(state.status === 'ready' && state.data.categories.length, 2);
    assert.equal(state.status === 'ready' && state.data.sections.length, 3);
  });

  it('omits only the empty collection: no categories', () => {
    const state = classifyHomeResult(undefined, ok({ ...homeData(), categories: [] }));

    assert.equal(state.status === 'ready' && state.data.categories.length, 0);
    assert.equal(state.status === 'ready' && state.data.banners.length, 2);
  });

  it('omits only the empty collection: one section without items', () => {
    const state = classifyHomeResult(undefined, ok(withoutItems(homeData(), 'new')));

    assert.equal(state.status, 'ready');
    assert.deepEqual(
      state.status === 'ready' && state.data.sections.map(({ id }) => id),
      ['best_sellers', 'offers'],
    );
    assert.equal(state.status === 'ready' && state.data.banners.length, 2);
  });

  it('does not mutate the data it receives', () => {
    const data = withoutItems(homeData(), 'new');
    const snapshot = structuredClone(data);

    classifyHomeResult(undefined, ok(data));

    assert.deepEqual(data, snapshot);
  });

  it('is empty when every collection arrives empty', () => {
    assert.deepEqual(classifyHomeResult(undefined, ok(allEmpty)), { status: 'empty' });
  });

  it('is empty when sections exist but none has items and the other collections are empty', () => {
    const data: HomeData = {
      banners: [],
      categories: [],
      sections: homeData().sections.map((section) => ({ ...section, items: [] })),
    };

    assert.deepEqual(classifyHomeResult(undefined, ok(data)), { status: 'empty' });
  });

  it('a successful empty answer replaces useful previous data with the empty state', () => {
    assert.deepEqual(classifyHomeResult(homeData(), ok(allEmpty)), { status: 'empty' });
  });
});

describe('classifyHomeResult: failures without previous data', () => {
  it('network (fetch failed without a response) is offline', () => {
    assert.deepEqual(classifyHomeResult(undefined, { kind: 'network' }), { status: 'offline' });
  });

  it('a 5xx response is an error, not offline', () => {
    assert.deepEqual(classifyHomeResult(undefined, { kind: 'http', status: 500 }), { status: 'error' });
    assert.deepEqual(classifyHomeResult(undefined, { kind: 'http', status: 503 }), { status: 'error' });
  });

  it('any other non-2xx response is an error', () => {
    assert.deepEqual(classifyHomeResult(undefined, { kind: 'http', status: 404 }), { status: 'error' });
  });

  it('a timeout is an error', () => {
    assert.deepEqual(classifyHomeResult(undefined, { kind: 'timeout' }), { status: 'error' });
  });

  it('an invalid payload is an error', () => {
    assert.deepEqual(classifyHomeResult(undefined, { kind: 'invalid' }), { status: 'error' });
  });
});

describe('classifyHomeResult: failures with previous data', () => {
  it('losing the network keeps the data and adds the offline notice', () => {
    const previous = homeData();

    assert.deepEqual(classifyHomeResult(previous, { kind: 'network' }), {
      status: 'ready',
      data: previous,
      notice: 'offline',
    });
  });

  it('HTTP errors, timeouts and invalid payloads keep the data with an update-failed notice', () => {
    const previous = homeData();
    const expected = { status: 'ready', data: previous, notice: 'update-failed' };

    assert.deepEqual(classifyHomeResult(previous, { kind: 'http', status: 500 }), expected);
    assert.deepEqual(classifyHomeResult(previous, { kind: 'timeout' }), expected);
    assert.deepEqual(classifyHomeResult(previous, { kind: 'invalid' }), expected);
  });

  it('keeps the previous data with its empty collections already omitted', () => {
    const previous = withoutItems(homeData(), 'offers');
    const state = classifyHomeResult(previous, { kind: 'network' });

    assert.equal(state.status, 'ready');
    assert.deepEqual(
      state.status === 'ready' && state.data.sections.map(({ id }) => id),
      ['best_sellers', 'new'],
    );
  });

  it('previous data that was entirely empty is not worth keeping: the failure screen shows', () => {
    assert.deepEqual(classifyHomeResult(allEmpty, { kind: 'network' }), { status: 'offline' });
    assert.deepEqual(classifyHomeResult(allEmpty, { kind: 'http', status: 500 }), { status: 'error' });
  });
});

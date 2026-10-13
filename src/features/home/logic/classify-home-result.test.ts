/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ApiError } from '../../../core/api/api-error.ts';
import type { HomeData } from '../contracts/home.ts';
import { homeData } from '../testing/home-test-data.ts';
import { classifyHomeResult, type HomeQuerySnapshot } from './classify-home-result.ts';

/*
 * A snapshot is what the RTK Query hook gives: `data` is the last successful payload (kept through
 * a failure), `error` is the failure of the latest settled request (RTK keeps it through the next
 * pending request and clears it on the next success) and `isFetching` is true while a request is
 * in flight.
 */
const settled = (data: HomeData | undefined): HomeQuerySnapshot => ({
  data,
  error: undefined,
  isFetching: false,
});
const failed = (data: HomeData | undefined, error: ApiError): HomeQuerySnapshot => ({
  data,
  error,
  isFetching: false,
});
const fetching = (data: HomeData | undefined, error?: ApiError): HomeQuerySnapshot => ({
  data,
  error,
  isFetching: true,
});

const network: ApiError = { kind: 'network' };
const withoutItems = (data: HomeData, id: string): HomeData => ({
  ...data,
  sections: data.sections.map((section) => (section.id === id ? { ...section, items: [] } : section)),
});
const allEmpty: HomeData = { banners: [], categories: [], sections: [] };

describe('classifyHomeResult: waiting', () => {
  it('is loading without previous data while the request is in flight', () => {
    assert.deepEqual(classifyHomeResult(fetching(undefined)), { status: 'loading' });
  });

  it('is loading when nothing is known yet (no data, no error, nothing in flight)', () => {
    assert.deepEqual(classifyHomeResult(settled(undefined)), { status: 'loading' });
  });

  it('keeps showing the previous data while a refetch is in flight, with no notice', () => {
    const previous = homeData();

    assert.deepEqual(classifyHomeResult(fetching(previous)), { status: 'ready', data: previous });
  });

  it('treats an aborted request like a pending one (the caller discards it)', () => {
    const previous = homeData();

    assert.deepEqual(classifyHomeResult(failed(undefined, { kind: 'aborted' })), { status: 'loading' });
    assert.deepEqual(classifyHomeResult(failed(previous, { kind: 'aborted' })), {
      status: 'ready',
      data: previous,
    });
  });
});

describe('classifyHomeResult: the error RTK keeps during a pending request', () => {
  // RTK Query does NOT clear `error` when the next request starts (only a success does), so the
  // screen would otherwise flip between failure and loading depending on the case.
  it('without data, retrying after a failure shows the skeleton again, not the failure screen', () => {
    assert.deepEqual(classifyHomeResult(fetching(undefined, network)), { status: 'loading' });
    assert.deepEqual(classifyHomeResult(fetching(undefined, { kind: 'http', status: 500 })), {
      status: 'loading',
    });
  });

  it('with data, the notice of the previous failure stays while the retry runs', () => {
    const previous = homeData();

    assert.deepEqual(classifyHomeResult(fetching(previous, network)), {
      status: 'ready',
      data: previous,
      notice: 'offline',
    });
    assert.deepEqual(classifyHomeResult(fetching(previous, { kind: 'timeout' })), {
      status: 'ready',
      data: previous,
      notice: 'update-failed',
    });
  });

  it('the notice goes away only when the retry succeeds (RTK clears the error and swaps the data)', () => {
    const fresh = { ...homeData(), banners: [] };

    assert.deepEqual(classifyHomeResult(settled(fresh)), { status: 'ready', data: fresh });
  });

  it('if the retry fails again the notice stays', () => {
    const previous = homeData();

    assert.deepEqual(classifyHomeResult(failed(previous, { kind: 'http', status: 503 })), {
      status: 'ready',
      data: previous,
      notice: 'update-failed',
    });
  });
});

describe('classifyHomeResult: success', () => {
  it('is ready with the data, without a notice', () => {
    const data = homeData();

    assert.deepEqual(classifyHomeResult(settled(data)), { status: 'ready', data });
  });

  it('omits only the empty collection: no banners', () => {
    const data = { ...homeData(), banners: [] };
    const state = classifyHomeResult(settled(data));

    assert.equal(state.status, 'ready');
    assert.deepEqual(state.status === 'ready' && state.data.banners, []);
    assert.equal(state.status === 'ready' && state.data.categories.length, 2);
    assert.equal(state.status === 'ready' && state.data.sections.length, 3);
  });

  it('omits only the empty collection: no categories', () => {
    const state = classifyHomeResult(settled({ ...homeData(), categories: [] }));

    assert.equal(state.status === 'ready' && state.data.categories.length, 0);
    assert.equal(state.status === 'ready' && state.data.banners.length, 2);
  });

  it('omits only the empty collection: one section without items', () => {
    const state = classifyHomeResult(settled(withoutItems(homeData(), 'new')));

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

    classifyHomeResult(settled(data));

    assert.deepEqual(data, snapshot);
  });

  it('is empty when every collection arrives empty', () => {
    assert.deepEqual(classifyHomeResult(settled(allEmpty)), { status: 'empty' });
  });

  it('is empty when sections exist but none has items and the other collections are empty', () => {
    const data: HomeData = {
      banners: [],
      categories: [],
      sections: homeData().sections.map((section) => ({ ...section, items: [] })),
    };

    assert.deepEqual(classifyHomeResult(settled(data)), { status: 'empty' });
  });

  it('refreshing over an empty answer shows the skeleton, as on Day 2', () => {
    assert.deepEqual(classifyHomeResult(fetching(allEmpty)), { status: 'loading' });
  });
});

describe('classifyHomeResult: failures without previous data', () => {
  it('network (fetch failed without a response) is offline', () => {
    assert.deepEqual(classifyHomeResult(failed(undefined, network)), { status: 'offline' });
  });

  it('a 5xx response is an error, not offline', () => {
    assert.deepEqual(classifyHomeResult(failed(undefined, { kind: 'http', status: 500 })), {
      status: 'error',
    });
    assert.deepEqual(classifyHomeResult(failed(undefined, { kind: 'http', status: 503 })), {
      status: 'error',
    });
  });

  it('any other non-2xx response is an error', () => {
    assert.deepEqual(classifyHomeResult(failed(undefined, { kind: 'http', status: 404 })), {
      status: 'error',
    });
  });

  it('a timeout is an error', () => {
    assert.deepEqual(classifyHomeResult(failed(undefined, { kind: 'timeout' })), { status: 'error' });
  });

  it('an invalid payload is an error', () => {
    assert.deepEqual(classifyHomeResult(failed(undefined, { kind: 'invalid' })), { status: 'error' });
  });
});

describe('classifyHomeResult: failures with previous data', () => {
  it('losing the network keeps the data and adds the offline notice', () => {
    const previous = homeData();

    assert.deepEqual(classifyHomeResult(failed(previous, network)), {
      status: 'ready',
      data: previous,
      notice: 'offline',
    });
  });

  it('HTTP errors, timeouts and invalid payloads keep the data with an update-failed notice', () => {
    const previous = homeData();
    const expected = { status: 'ready', data: previous, notice: 'update-failed' };

    assert.deepEqual(classifyHomeResult(failed(previous, { kind: 'http', status: 500 })), expected);
    assert.deepEqual(classifyHomeResult(failed(previous, { kind: 'timeout' })), expected);
    assert.deepEqual(classifyHomeResult(failed(previous, { kind: 'invalid' })), expected);
  });

  it('keeps the previous data with its empty collections already omitted', () => {
    const previous = withoutItems(homeData(), 'offers');
    const state = classifyHomeResult(failed(previous, network));

    assert.equal(state.status, 'ready');
    assert.deepEqual(
      state.status === 'ready' && state.data.sections.map(({ id }) => id),
      ['best_sellers', 'new'],
    );
  });

  it('previous data that was entirely empty is not worth keeping: the failure screen shows', () => {
    assert.deepEqual(classifyHomeResult(failed(allEmpty, network)), { status: 'offline' });
    assert.deepEqual(classifyHomeResult(failed(allEmpty, { kind: 'http', status: 500 })), {
      status: 'error',
    });
  });
});

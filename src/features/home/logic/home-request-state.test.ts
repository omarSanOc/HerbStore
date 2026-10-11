/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { FetchJsonOutcome } from '../../../core/network/http.ts';
import type { HomeData } from '../contracts/home.ts';
import { homeData } from '../testing/home-test-data.ts';
import {
  homeRequestReducer,
  initialHomeRequestState,
  selectHomeScreenState,
  selectIsRefreshing,
  type HomeRequestAction,
  type HomeRequestState,
} from './home-request-state.ts';

type Outcome = FetchJsonOutcome<HomeData>;

const ok = (data: HomeData = homeData()): Outcome => ({ kind: 'ok', data, status: 200 });
const network: Outcome = { kind: 'network' };
const serverError: Outcome = { kind: 'http', status: 500 };

function run(...actions: HomeRequestAction[]): HomeRequestState {
  return actions.reduce(homeRequestReducer, initialHomeRequestState);
}

const settled = (requestId: number, outcome: Outcome): HomeRequestAction => ({
  type: 'settled',
  requestId,
  outcome,
});
const refetch: HomeRequestAction = { type: 'refetch' };

describe('homeRequestReducer: the first request', () => {
  it('starts as request 1, pending, with nothing settled', () => {
    assert.deepEqual(initialHomeRequestState, {
      requestId: 1,
      isPending: true,
      data: undefined,
      outcome: undefined,
    });
  });

  it('settles with the answer of the current request', () => {
    const data = homeData();
    const state = run(settled(1, ok(data)));

    assert.equal(state.isPending, false);
    assert.equal(state.requestId, 1);
    assert.equal(state.data, data);
    assert.deepEqual(state.outcome, ok(data));
  });

  it('a failure settles without data', () => {
    const state = run(settled(1, network));

    assert.equal(state.isPending, false);
    assert.equal(state.data, undefined);
    assert.deepEqual(state.outcome, network);
  });
});

describe('homeRequestReducer: refetch', () => {
  it('starts a new request id and keeps the data and the last outcome for the notice', () => {
    const data = homeData();
    const before = run(settled(1, ok(data)), refetch);

    assert.equal(before.requestId, 2);
    assert.equal(before.isPending, true);
    assert.equal(before.data, data);
    assert.deepEqual(before.outcome, ok(data));
  });

  it('is ignored while a request is already pending (no parallel requests)', () => {
    assert.equal(run(refetch), initialHomeRequestState);
    assert.equal(run(refetch, refetch).requestId, 1);
  });

  it('a failed refresh keeps the previous data', () => {
    const data = homeData();
    const state = run(settled(1, ok(data)), refetch, settled(2, network));

    assert.equal(state.data, data);
    assert.deepEqual(state.outcome, network);
    assert.equal(state.isPending, false);
  });

  it('a successful refresh replaces the data', () => {
    const fresh = { ...homeData(), banners: [] };
    const state = run(settled(1, ok()), refetch, settled(2, ok(fresh)));

    assert.equal(state.data, fresh);
  });

  it('does not mutate the previous state', () => {
    const before = run(settled(1, network));
    const snapshot = structuredClone(before);

    homeRequestReducer(before, refetch);

    assert.deepEqual(before, snapshot);
  });
});

describe('homeRequestReducer: stale answers', () => {
  it('ignores an answer bound to an older request', () => {
    const afterRetry = run(settled(1, network), refetch);
    const state = homeRequestReducer(afterRetry, settled(1, ok()));

    assert.equal(state, afterRetry);
    assert.equal(state.isPending, true);
    assert.equal(state.requestId, 2);
  });

  it('ignores an answer for a request that never existed', () => {
    assert.equal(homeRequestReducer(initialHomeRequestState, settled(7, ok())), initialHomeRequestState);
  });

  it('ignores a duplicate answer after the request already settled', () => {
    const first = run(settled(1, network));
    const state = homeRequestReducer(first, settled(1, ok()));

    assert.equal(state, first);
    assert.deepEqual(state.outcome, network);
  });

  it('ignores aborted outcomes: the request stays pending', () => {
    const state = homeRequestReducer(initialHomeRequestState, settled(1, { kind: 'aborted' }));

    assert.equal(state, initialHomeRequestState);
  });

  it('the newest request wins when the older one answers last', () => {
    const data = homeData();
    const state = run(settled(1, network), refetch, settled(2, ok(data)), settled(1, serverError));

    assert.equal(state.data, data);
    assert.deepEqual(state.outcome, ok(data));
  });
});

describe('selectHomeScreenState', () => {
  it('is loading before the first answer', () => {
    assert.deepEqual(selectHomeScreenState(initialHomeRequestState), { status: 'loading' });
  });

  it('is ready after a success', () => {
    const data = homeData();

    assert.deepEqual(selectHomeScreenState(run(settled(1, ok(data)))), { status: 'ready', data });
  });

  it('distinguishes offline (no response) from error (bad response), without data', () => {
    assert.deepEqual(selectHomeScreenState(run(settled(1, network))), { status: 'offline' });
    assert.deepEqual(selectHomeScreenState(run(settled(1, serverError))), { status: 'error' });
    assert.deepEqual(selectHomeScreenState(run(settled(1, { kind: 'timeout' }))), { status: 'error' });
  });

  it('is empty when everything arrives empty', () => {
    const empty: HomeData = { banners: [], categories: [], sections: [] };

    assert.deepEqual(selectHomeScreenState(run(settled(1, ok(empty)))), { status: 'empty' });
  });

  it('retrying from a failure without data shows loading again', () => {
    assert.deepEqual(selectHomeScreenState(run(settled(1, network), refetch)), { status: 'loading' });
    assert.deepEqual(selectHomeScreenState(run(settled(1, serverError), refetch)), { status: 'loading' });
  });

  it('retrying from the empty state shows loading again', () => {
    const empty: HomeData = { banners: [], categories: [], sections: [] };

    assert.deepEqual(selectHomeScreenState(run(settled(1, ok(empty)), refetch)), { status: 'loading' });
  });

  it('keeps the data and the offline notice after a failed refresh', () => {
    const data = homeData();

    assert.deepEqual(selectHomeScreenState(run(settled(1, ok(data)), refetch, settled(2, network))), {
      status: 'ready',
      data,
      notice: 'offline',
    });
  });

  it('keeps the data with update-failed after an HTTP failure or a timeout', () => {
    const data = homeData();

    assert.deepEqual(selectHomeScreenState(run(settled(1, ok(data)), refetch, settled(2, serverError))), {
      status: 'ready',
      data,
      notice: 'update-failed',
    });
    assert.deepEqual(
      selectHomeScreenState(run(settled(1, ok(data)), refetch, settled(2, { kind: 'timeout' }))),
      { status: 'ready', data, notice: 'update-failed' },
    );
  });

  it('keeps the notice visible while the next refresh is in flight (no flicker)', () => {
    const data = homeData();
    const state = selectHomeScreenState(run(settled(1, ok(data)), refetch, settled(2, network), refetch));

    assert.deepEqual(state, { status: 'ready', data, notice: 'offline' });
  });

  it('drops the notice once a refresh succeeds', () => {
    const fresh = homeData();
    const state = run(settled(1, ok()), refetch, settled(2, network), refetch, settled(3, ok(fresh)));

    assert.deepEqual(selectHomeScreenState(state), { status: 'ready', data: fresh });
  });

  it('a refresh in flight after a success shows the data without a notice', () => {
    const data = homeData();

    assert.deepEqual(selectHomeScreenState(run(settled(1, ok(data)), refetch)), { status: 'ready', data });
  });
});

describe('selectIsRefreshing', () => {
  it('is false for the first load (the skeleton is shown, not the pull indicator)', () => {
    assert.equal(selectIsRefreshing(initialHomeRequestState), false);
    assert.equal(selectIsRefreshing(run(settled(1, network), refetch)), false);
  });

  it('is true while a refresh runs over visible data', () => {
    assert.equal(selectIsRefreshing(run(settled(1, ok()), refetch)), true);
    assert.equal(selectIsRefreshing(run(settled(1, ok()), refetch, settled(2, network), refetch)), true);
  });

  it('is false once the refresh settles', () => {
    assert.equal(selectIsRefreshing(run(settled(1, ok()), refetch, settled(2, network))), false);
    assert.equal(selectIsRefreshing(run(settled(1, ok()), refetch, settled(2, ok()))), false);
  });
});

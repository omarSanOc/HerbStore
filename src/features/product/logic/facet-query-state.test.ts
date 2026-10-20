/// <reference types="node" />
// RF-23, RF-27, RF-30, RF-34 (spec 007, T3). What the brands / subcategories panel renders is a
// pure rule over the query snapshot, the same way Home and the product list classify theirs: the
// component only `switch`es on the status, so every state of the matrix is testable without UI.
//
// Android: a `sealed interface FacetUiState` in the ViewModel. SwiftUI: an enum with an associated
// `options` value, rendered by one `switch`. Same idea: one type, exhaustively handled.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ApiError } from '../../../core/api/api-error.ts';
import { classifyFacetQueryState, type FacetQuerySnapshot } from './facet-query-state.ts';

const OPTIONS = [{ name: 'AsterVale Nutrition' }, { name: 'Fernlight Labs' }];

function snapshot(partial: Partial<FacetQuerySnapshot<{ name: string }>> = {}): FacetQuerySnapshot<{ name: string }> {
  return { currentData: undefined, error: undefined, isFetching: false, ...partial };
}

function status(partial: Partial<FacetQuerySnapshot<{ name: string }>> = {}) {
  return classifyFacetQueryState(snapshot(partial)).status;
}

describe('classifyFacetQueryState: first load', () => {
  it('is loading while the first request is in flight', () => {
    assert.equal(status({ isFetching: true }), 'loading');
  });

  it('is loading while nothing is known yet (a request about to start)', () => {
    assert.equal(status(), 'loading');
  });

  it('never borrows the options of another entry: without currentData there is nothing to show', () => {
    // `data` of RTK would still hold the PREVIOUS language here; `currentData` is undefined, so the
    // panel announces loading instead of printing names of the language being left (RF-24).
    assert.equal(status({ currentData: undefined, isFetching: true }), 'loading');
  });
});

describe('classifyFacetQueryState: with options', () => {
  it('is ready with the options of the current entry', () => {
    const state = classifyFacetQueryState(snapshot({ currentData: OPTIONS }));
    assert.deepEqual(state, { status: 'ready', options: OPTIONS });
  });

  it('is empty for a valid empty array (the panel says "without options", not "loading")', () => {
    assert.equal(status({ currentData: [] }), 'empty');
  });

  it('stays ready (no notice) while a revalidation of good options is in flight', () => {
    assert.equal(status({ currentData: OPTIONS, isFetching: true }), 'ready');
  });
});

describe('classifyFacetQueryState: failure without options', () => {
  it('is offline when fetch failed without a response', () => {
    assert.equal(status({ error: { kind: 'network' } }), 'offline');
  });

  it('is error for a 5xx, a 4xx, a timeout or an invalid body (never "offline")', () => {
    const failures: ApiError[] = [
      { kind: 'http', status: 500 },
      { kind: 'http', status: 422 },
      { kind: 'timeout' },
      { kind: 'invalid' },
    ];
    for (const error of failures) assert.equal(status({ error }), 'error', error.kind);
  });

  it('is not a failure while the retry is in flight: the panel shows loading again', () => {
    assert.equal(status({ error: { kind: 'network' }, isFetching: true }), 'loading');
  });

  it('ignores a cancellation (unmount, new request): it is not an error', () => {
    assert.equal(status({ error: { kind: 'aborted' } }), 'loading');
  });

  it('an empty array plus a failure is a failure screen: there are no options to keep', () => {
    assert.equal(status({ currentData: [], error: { kind: 'network' } }), 'offline');
    assert.equal(status({ currentData: [], error: { kind: 'http', status: 500 } }), 'error');
  });
});

describe('classifyFacetQueryState: previous options after a failed refresh', () => {
  it('keeps the options and reports the stale update (offline transport)', () => {
    const state = classifyFacetQueryState(
      snapshot({ currentData: OPTIONS, error: { kind: 'network' } }),
    );
    assert.deepEqual(state, { status: 'stale', options: OPTIONS });
  });

  it('keeps the options and reports the stale update (5xx / invalid body)', () => {
    for (const error of [{ kind: 'http', status: 503 }, { kind: 'invalid' }] as ApiError[]) {
      const state = classifyFacetQueryState(snapshot({ currentData: OPTIONS, error }));
      assert.deepEqual(state, { status: 'stale', options: OPTIONS });
    }
  });

  it('keeps showing them while the retry is in flight (the notice does not flicker away)', () => {
    const state = classifyFacetQueryState(
      snapshot({ currentData: OPTIONS, error: { kind: 'network' }, isFetching: true }),
    );
    assert.deepEqual(state, { status: 'stale', options: OPTIONS });
  });
});

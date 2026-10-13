/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isOfflineError, toApiError, toBaseQueryResult } from './api-error.ts';

describe('toBaseQueryResult', () => {
  it('maps ok to { data } and drops the status', () => {
    assert.deepEqual(toBaseQueryResult({ kind: 'ok', data: { id: 'p1' }, status: 200 }), {
      data: { id: 'p1' },
    });
  });

  it('maps every failure to a typed { error }, keeping the http status', () => {
    assert.deepEqual(toBaseQueryResult({ kind: 'network' }), { error: { kind: 'network' } });
    assert.deepEqual(toBaseQueryResult({ kind: 'http', status: 503 }), {
      error: { kind: 'http', status: 503 },
    });
    assert.deepEqual(toBaseQueryResult({ kind: 'invalid' }), { error: { kind: 'invalid' } });
    assert.deepEqual(toBaseQueryResult({ kind: 'timeout' }), { error: { kind: 'timeout' } });
    assert.deepEqual(toBaseQueryResult({ kind: 'aborted' }), { error: { kind: 'aborted' } });
  });
});

describe('isOfflineError', () => {
  it('is true only for a fetch failure without response', () => {
    assert.equal(isOfflineError({ kind: 'network' }), true);
    assert.equal(isOfflineError({ kind: 'http', status: 503 }), false);
    assert.equal(isOfflineError({ kind: 'timeout' }), false);
    assert.equal(isOfflineError({ kind: 'invalid' }), false);
    assert.equal(isOfflineError({ kind: 'aborted' }), false);
    assert.equal(isOfflineError(undefined), false);
  });
});

describe('toApiError', () => {
  it('returns an ApiError untouched', () => {
    assert.deepEqual(toApiError({ kind: 'network' }), { kind: 'network' });
    assert.deepEqual(toApiError({ kind: 'http', status: 503 }), { kind: 'http', status: 503 });
    assert.deepEqual(toApiError({ kind: 'timeout' }), { kind: 'timeout' });
    assert.deepEqual(toApiError({ kind: 'invalid' }), { kind: 'invalid' });
    assert.deepEqual(toApiError({ kind: 'aborted' }), { kind: 'aborted' });
  });

  it('gives undefined when there is no error', () => {
    assert.equal(toApiError(undefined), undefined);
  });

  it('recognizes the abort that RTK Query records itself as a cancellation, not a failure', () => {
    // `promise.abort()` ends the entry as `rejected` with a SerializedError named `AbortError`
    // (T9: a pull-to-refresh cancels the next page in flight). It is our own cancellation, so the
    // list must not show a failure for it.
    assert.deepEqual(toApiError({ name: 'AbortError', message: 'Aborted' }), { kind: 'aborted' });
    assert.deepEqual(toApiError({ name: 'AbortError' }), { kind: 'aborted' });
  });

  it('turns an error that did not come from our base query into a generic invalid one', () => {
    // RTK can end an entry with its own shapes: a thrown error serialized by Redux Toolkit, or the
    // `CUSTOM_ERROR` that `retry` produces when the request is aborted. The screen shows the error
    // state with a manual retry instead of waiting forever.
    assert.deepEqual(toApiError({ name: 'Error', message: 'boom' }), { kind: 'invalid' });
    assert.deepEqual(toApiError({ status: 'CUSTOM_ERROR', error: 'Aborted' }), { kind: 'invalid' });
    assert.deepEqual(toApiError({ kind: 'http' }), { kind: 'invalid' });
    assert.deepEqual(toApiError({ kind: 'weird' }), { kind: 'invalid' });
    assert.deepEqual(toApiError('boom'), { kind: 'invalid' });
  });
});

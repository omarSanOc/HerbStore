/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { FetchJsonOutcome } from '../../../core/network/http.ts';
import type { HomeData } from '../contracts/home.ts';
import { homeData } from '../testing/home-test-data.ts';
import { homeRequestReducer, initialHomeRequestState } from './home-request-state.ts';
import { shouldRefetchOnFocus, shouldRefetchOnForeground } from './refetch-policy.ts';

type Outcome = FetchJsonOutcome<HomeData>;

const idle = (outcome: Outcome | undefined) => ({ isPending: false, outcome });
const ok: Outcome = { kind: 'ok', data: homeData(), status: 200 };
const failures: readonly Outcome[] = [
  { kind: 'network' },
  { kind: 'http', status: 500 },
  { kind: 'timeout' },
  { kind: 'invalid' },
];

describe('shouldRefetchOnForeground (AppState active)', () => {
  it('refetches after a success: coming back to the app refreshes the data', () => {
    assert.equal(shouldRefetchOnForeground(idle(ok)), true);
  });

  it('refetches after every kind of failure', () => {
    for (const outcome of failures) {
      assert.equal(shouldRefetchOnForeground(idle(outcome)), true, outcome.kind);
    }
  });

  it('does not refetch before the first answer while the first request is in flight', () => {
    assert.equal(shouldRefetchOnForeground({ isPending: true, outcome: undefined }), false);
  });

  it('refetches when the first request already failed (there is an answer to recover from)', () => {
    assert.equal(shouldRefetchOnForeground(idle({ kind: 'network' })), true);
    assert.equal(shouldRefetchOnForeground(idle({ kind: 'timeout' })), true);
  });

  it('does not refetch while a request is in flight, whatever the previous answer was', () => {
    assert.equal(shouldRefetchOnForeground({ isPending: true, outcome: ok }), false);
    assert.equal(shouldRefetchOnForeground({ isPending: true, outcome: { kind: 'network' } }), false);
  });

  it('has nothing to repeat when no request ever ran or settled', () => {
    assert.equal(shouldRefetchOnForeground(idle(undefined)), false);
  });

  it('never treats an aborted outcome as an answer', () => {
    assert.equal(shouldRefetchOnForeground(idle({ kind: 'aborted' })), false);
  });
});

describe('shouldRefetchOnFocus (navigation focus)', () => {
  it('never refetches before the first answer', () => {
    assert.equal(shouldRefetchOnFocus({ isPending: true, outcome: undefined }), false);
    assert.equal(shouldRefetchOnFocus(idle(undefined)), false);
  });

  it('does not refetch after a success, so coming back from a product repeats nothing', () => {
    assert.equal(shouldRefetchOnFocus(idle(ok)), false);
  });

  it('refetches after every kind of failure', () => {
    for (const outcome of failures) {
      assert.equal(shouldRefetchOnFocus(idle(outcome)), true, outcome.kind);
    }
  });

  it('does not refetch while a request is already in flight, even after a failure', () => {
    assert.equal(shouldRefetchOnFocus({ isPending: true, outcome: { kind: 'network' } }), false);
  });

  it('never treats an aborted outcome as a failure', () => {
    assert.equal(shouldRefetchOnFocus(idle({ kind: 'aborted' })), false);
  });
});

describe('foreground and focus on the same tick', () => {
  it('start a single request: the reducer ignores the second trigger while one is in flight', () => {
    const failed = homeRequestReducer(initialHomeRequestState, {
      type: 'settled',
      requestId: 1,
      outcome: { kind: 'network' },
    });
    assert.equal(shouldRefetchOnForeground(failed), true);
    assert.equal(shouldRefetchOnFocus(failed), true);

    // Both listeners were armed from the same state and both fire: two `refetch` actions.
    const afterForeground = homeRequestReducer(failed, { type: 'refetch' });
    const afterFocus = homeRequestReducer(afterForeground, { type: 'refetch' });

    assert.equal(afterForeground.requestId, failed.requestId + 1);
    assert.equal(afterFocus, afterForeground);
    // And once pending, neither rule would arm a listener again.
    assert.equal(shouldRefetchOnForeground(afterFocus), false);
    assert.equal(shouldRefetchOnFocus(afterFocus), false);
  });
});

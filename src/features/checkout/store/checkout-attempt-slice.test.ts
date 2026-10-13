import assert from 'node:assert/strict';
import test from 'node:test';
import { checkoutAttemptReducer, attemptSubmitted, attemptRestored, attemptOutcome } from './checkout-attempt-slice.ts';

test('persists only non-reversible attempt metadata and restores preliminary as unresolved', () => {
  let state = checkoutAttemptReducer(undefined, attemptSubmitted({ key: 'k', fingerprint: 'f' }));
  assert.deepEqual(state, { key: 'k', fingerprint: 'f', status: 'preliminary' });
  state = checkoutAttemptReducer(state, attemptRestored());
  assert.equal(state.status, 'unresolved');
  assert.deepEqual(checkoutAttemptReducer(state, attemptOutcome({ source: 'status', outcome: 'confirmed' })), { status: 'idle' });
});

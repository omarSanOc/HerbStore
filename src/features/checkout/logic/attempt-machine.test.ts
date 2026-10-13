import assert from 'node:assert/strict';
import test from 'node:test';
import { initialAttempt, transitionAttempt } from './attempt-machine.ts';

const meta = { key: 'key', fingerprint: 'fp' };
const active = (status: 'preliminary' | 'unresolved') => ({ ...meta, status });
test('covers the idempotency transition matrix', () => {
  assert.deepEqual(transitionAttempt(initialAttempt, { type: 'submitted', ...meta }), active('preliminary'));
  assert.equal(transitionAttempt(active('preliminary'), { type: 'postOutcome', outcome: 'validation' }).status, 'idle');
  assert.equal(transitionAttempt(active('preliminary'), { type: 'postOutcome', outcome: 'outOfStock' }).status, 'idle');
  for (const outcome of ['pending', 'keyReused', 'uncertain', 'inconsistent']) assert.equal(transitionAttempt(active('preliminary'), { type: 'postOutcome', outcome: outcome as never }).status, 'unresolved');
  for (const outcome of ['validation', 'outOfStock', 'pending', 'keyReused', 'uncertain', 'inconsistent']) assert.equal(transitionAttempt(active('unresolved'), { type: 'statusOutcome', outcome: outcome as never }).status, 'unresolved');
  for (const outcome of ['confirmed', 'notCreated', 'expired']) {
    assert.equal(transitionAttempt(active('unresolved'), { type: 'statusOutcome', outcome: outcome as never }).status, 'idle');
  }
  assert.equal(transitionAttempt(active('preliminary'), { type: 'restored' }).status, 'unresolved');
  assert.equal(transitionAttempt(active('unresolved'), { type: 'waitCancelled' }).status, 'unresolved');
});

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

// T2 (RF-3, RF-17): the same matrix as an explicit table. One row = one transition, so a reader
// (and a failing run) names the exact case. JUnit `@ParameterizedTest` / XCTest loop over cases.
type Row = readonly [label: string, from: 'idle' | 'preliminary' | 'unresolved', event: Parameters<typeof transitionAttempt>[1], to: 'idle' | 'preliminary' | 'unresolved'];

const post = (outcome: string) => ({ type: 'postOutcome', outcome }) as never;
const status = (outcome: string) => ({ type: 'statusOutcome', outcome }) as never;
const stateAt = (at: 'idle' | 'preliminary' | 'unresolved') => (at === 'idle' ? initialAttempt : active(at));

const rows: readonly Row[] = [
  // POST answered while the attempt is `preliminary` (nobody knows yet what the server did).
  ['POST 200 confirmed ends the attempt', 'preliminary', post('confirmed'), 'idle'],
  ['POST 400 validation: nothing was created, form is editable again', 'preliminary', post('validation'), 'idle'],
  ['POST 409 out of stock: nothing was created', 'preliminary', post('outOfStock'), 'idle'],
  ['POST 202 pending: the server accepted it, wait', 'preliminary', post('pending'), 'unresolved'],
  ['POST 409 key reused: another attempt may exist, ask for its status', 'preliminary', post('keyReused'), 'unresolved'],
  ['POST timeout / 503 / offline (uncertain): it may have been created', 'preliminary', post('uncertain'), 'unresolved'],
  ['POST with a body nobody understands (inconsistent)', 'preliminary', post('inconsistent'), 'unresolved'],
  ['POST 404 not created is only meaningful for a status query, but frees the key', 'preliminary', post('notCreated'), 'idle'],
  ['POST 410 expired likewise', 'preliminary', post('expired'), 'idle'],
  // Status queries on an `unresolved` attempt.
  ['status 200 confirmed ends the attempt', 'unresolved', status('confirmed'), 'idle'],
  ['status 404 not created: safe to start over', 'unresolved', status('notCreated'), 'idle'],
  ['status 410 expired: safe to start over', 'unresolved', status('expired'), 'idle'],
  ['status 202 pending keeps waiting', 'unresolved', status('pending'), 'unresolved'],
  ['status timeout / 503 / offline (uncertain) keeps waiting', 'unresolved', status('uncertain'), 'unresolved'],
  ['status key reused keeps waiting', 'unresolved', status('keyReused'), 'unresolved'],
  ['status inconsistent keeps waiting', 'unresolved', status('inconsistent'), 'unresolved'],
  // validation/outOfStock only free the attempt as the answer to the POST, never from a status query.
  ['status validation does NOT free an unresolved attempt', 'unresolved', status('validation'), 'unresolved'],
  ['status out of stock does NOT free an unresolved attempt', 'unresolved', status('outOfStock'), 'unresolved'],
  ['a POST answer arriving late (unresolved) validation does NOT free it either', 'unresolved', post('validation'), 'unresolved'],
  // Lifecycle events.
  ['restore after a process kill: preliminary becomes unresolved', 'preliminary', { type: 'restored' }, 'unresolved'],
  ['restore leaves an unresolved attempt alone', 'unresolved', { type: 'restored' }, 'unresolved'],
  ['cancelling the wait never frees the attempt', 'unresolved', { type: 'waitCancelled' }, 'unresolved'],
  ['cancelling the wait on preliminary changes nothing', 'preliminary', { type: 'waitCancelled' }, 'preliminary'],
  // Idle ignores everything but a submit.
  ['idle ignores a stray POST answer', 'idle', post('confirmed'), 'idle'],
  ['idle ignores a stray status answer', 'idle', status('pending'), 'idle'],
  ['idle ignores restore', 'idle', { type: 'restored' }, 'idle'],
  // Double tap: a second submit while one is active must not replace the key.
  ['a second submit while preliminary is ignored', 'preliminary', { type: 'submitted', key: 'other', fingerprint: 'other' }, 'preliminary'],
  ['a second submit while unresolved is ignored', 'unresolved', { type: 'submitted', key: 'other', fingerprint: 'other' }, 'unresolved'],
];

test('transition table: every (state, event) pair lands where the idempotency protocol says', () => {
  for (const [label, from, event, to] of rows) {
    assert.equal(transitionAttempt(stateAt(from), event).status, to, label);
  }
});

test('the key and fingerprint of an attempt are stable across every transition that keeps it open', () => {
  for (const [label, from, event, to] of rows) {
    if (from === 'idle' || to === 'idle') continue;
    const next = transitionAttempt(stateAt(from), event);
    assert.equal(next.status !== 'idle' && next.key, 'key', label);
    assert.equal(next.status !== 'idle' && next.fingerprint, 'fp', label);
  }
});

test('an attempt only ends (idle) with proof: confirmed, not created, expired, or a refused POST', () => {
  const outcomes = ['confirmed', 'pending', 'validation', 'outOfStock', 'keyReused', 'notCreated', 'expired', 'uncertain', 'inconsistent'];
  const proof = new Set(['confirmed', 'notCreated', 'expired']);
  for (const outcome of outcomes) {
    for (const from of ['preliminary', 'unresolved'] as const) {
      for (const type of ['postOutcome', 'statusOutcome'] as const) {
        const ended = transitionAttempt(stateAt(from), { type, outcome } as never).status === 'idle';
        const refusedPost = type === 'postOutcome' && from === 'preliminary' && (outcome === 'validation' || outcome === 'outOfStock');
        assert.equal(ended, proof.has(outcome) || refusedPost, `${from} + ${type} ${outcome}`);
      }
    }
  }
});

test('a pending answer records that the server accepted the order; a later uncertain one keeps that fact', () => {
  const waiting = transitionAttempt(active('preliminary'), post('pending'));
  assert.deepEqual(waiting, { ...meta, status: 'unresolved', remoteStatus: 'pending' });
  const again = transitionAttempt(waiting, status('uncertain'));
  assert.deepEqual(again, { ...meta, status: 'unresolved', remoteStatus: 'pending' });
});

test('transitions are pure: the input state is never mutated', () => {
  const before = Object.freeze({ ...meta, status: 'preliminary' as const });
  assert.doesNotThrow(() => transitionAttempt(before, post('pending')));
  assert.deepEqual(before, { ...meta, status: 'preliminary' });
});

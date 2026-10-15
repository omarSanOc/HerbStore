/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';

import type { AttemptOutcome, AttemptStatus } from './attempt-machine.ts';
import {
  initialRedirectPhase,
  nextRedirect,
  type RedirectEvent,
  type RedirectPhase,
  type RedirectTarget,
} from './order-status-redirect.ts';

/** Feeds events in order and returns every redirect decided along the way. */
function run(events: readonly RedirectEvent[], from: RedirectPhase = initialRedirectPhase) {
  let phase = from;
  const redirects: (RedirectTarget | null)[] = [];
  for (const event of events) {
    const decision = nextRedirect(phase, event);
    phase = decision.phase;
    redirects.push(decision.redirect);
  }
  return { phase, redirects, decided: redirects.filter((value) => value !== null) };
}

const observed = (status: AttemptStatus): RedirectEvent => ({ type: 'attemptObserved', status });
const finished = (outcome: AttemptOutcome | undefined, status: AttemptStatus): RedirectEvent => ({ type: 'consultFinished', outcome, status });
const started: RedirectEvent = { type: 'consultStarted' };
const left: RedirectEvent = { type: 'left' };

test('starts watching', () => {
  assert.equal(initialRedirectPhase, 'watching');
});

test('mounting without an attempt redirects to checkout exactly once', () => {
  const result = run([observed('idle'), observed('idle'), observed('idle')]);
  assert.deepEqual(result.redirects, ['checkout', null, null]);
  assert.equal(result.phase, 'done');
});

test('a pending or unresolved attempt keeps the screen without a destination', () => {
  for (const status of ['unresolved', 'preliminary'] as const) {
    const result = run([observed(status), observed(status)]);
    assert.deepEqual(result.redirects, [null, null]);
    assert.equal(result.phase, 'watching');
  }
});

test('idle observed while the consult runs does not redirect; confirmed goes to the confirmation only', () => {
  const result = run([observed('unresolved'), started, observed('idle'), observed('idle'), finished('confirmed', 'idle'), observed('idle')]);
  assert.deepEqual(result.decided, ['order-confirmation']);
  assert.ok(!result.redirects.includes('checkout'));
  assert.equal(result.phase, 'done');
});

test('confirmed decides the confirmation even if the attempt status is reported as still active', () => {
  assert.deepEqual(nextRedirect('consulting', finished('confirmed', 'unresolved')), { phase: 'done', redirect: 'order-confirmation' });
});

test('notCreated and expired send the user back to checkout once', () => {
  for (const outcome of ['notCreated', 'expired'] as const) {
    const result = run([started, observed('idle'), finished(outcome, 'idle'), observed('idle')]);
    assert.deepEqual(result.decided, ['checkout']);
    assert.equal(result.phase, 'done');
  }
});

test('a still pending consult returns to watching without a destination', () => {
  for (const outcome of ['pending', 'uncertain', 'keyReused', 'inconsistent'] as const) {
    assert.deepEqual(nextRedirect('consulting', finished(outcome, 'unresolved')), { phase: 'watching', redirect: null });
  }
  // Back in watching, a later idle (e.g. another consult confirmed elsewhere) still redirects once.
  const result = run([started, finished('pending', 'unresolved'), observed('unresolved'), observed('idle'), observed('idle')]);
  assert.deepEqual(result.decided, ['checkout']);
});

test('leaving blocks every late result', () => {
  const events: RedirectEvent[] = [observed('idle'), started, finished('confirmed', 'idle'), finished('notCreated', 'idle'), finished(undefined, 'idle')];
  assert.deepEqual(run([left, ...events]).decided, []);
  // Leaving in the middle of a consult also blocks its continuation.
  const midConsult = run([started, left, observed('idle'), finished('confirmed', 'idle')]);
  assert.deepEqual(midConsult.decided, []);
  assert.equal(midConsult.phase, 'done');
});

test('a failed unwrap decides by the current attempt status', () => {
  assert.deepEqual(nextRedirect('consulting', finished(undefined, 'idle')), { phase: 'done', redirect: 'checkout' });
  assert.deepEqual(nextRedirect('consulting', finished(undefined, 'unresolved')), { phase: 'watching', redirect: null });
});

test('done never decides again, whatever the event', () => {
  const events: RedirectEvent[] = [observed('idle'), started, finished('confirmed', 'idle'), finished(undefined, 'idle'), left];
  for (const event of events) assert.deepEqual(nextRedirect('done', event), { phase: 'done', redirect: null });
});

test('a consult finish without a started consult is ignored', () => {
  assert.deepEqual(nextRedirect('watching', finished('confirmed', 'idle')), { phase: 'watching', redirect: null });
});

test('starting a consult twice keeps a single consulting phase', () => {
  assert.deepEqual(run([started, started]).phase, 'consulting');
});

/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';

import { createNavigationLockout, NAVIGATION_LOCKOUT_MS } from './navigation-lockout.ts';

/** A lockout over a clock the test moves by hand. */
function withClock(windowMs?: number) {
  let time = 1_000_000;
  const lockout = createNavigationLockout({ windowMs, now: () => time });
  let calls = 0;
  const press = () => lockout.run(() => void (calls += 1));
  return {
    press,
    calls: () => calls,
    advance: (ms: number) => void (time += ms),
    setTime: (value: number) => void (time = value),
  };
}

test('the first press runs the action', () => {
  const clock = withClock();
  assert.equal(clock.press(), true);
  assert.equal(clock.calls(), 1);
});

test('a second press ~100 ms later (the measured double tap) is ignored', () => {
  const clock = withClock();
  clock.press();
  clock.advance(100);
  assert.equal(clock.press(), false);
  assert.equal(clock.calls(), 1);
});

test('the window is [0, windowMs): the last blocked instant and the first free one', () => {
  const clock = withClock();
  clock.press();
  clock.advance(NAVIGATION_LOCKOUT_MS - 1);
  assert.equal(clock.press(), false);
  clock.advance(1);
  assert.equal(clock.press(), true);
  assert.equal(clock.calls(), 2);
});

test('a blocked press does not extend the window (holding the button never locks it for good)', () => {
  const clock = withClock(500);
  clock.press();
  clock.advance(300);
  clock.press();
  clock.advance(300); // 600 ms after the FIRST press
  assert.equal(clock.press(), true);
});

test('a clock that jumps backwards never blocks navigation', () => {
  const clock = withClock();
  clock.press();
  clock.setTime(1_000_000 - 3_600_000);
  assert.equal(clock.press(), true);
});

test('the action may throw: the lockout still counted the press', () => {
  const lockout = createNavigationLockout({ now: () => 5 });
  assert.throws(() => lockout.run(() => { throw new Error('router failed'); }));
  assert.equal(lockout.run(() => undefined), false);
});

test('two lockouts do not share state (one per screen)', () => {
  const a = createNavigationLockout({ now: () => 5 });
  const b = createNavigationLockout({ now: () => 5 });
  assert.equal(a.run(() => undefined), true);
  assert.equal(b.run(() => undefined), true);
});

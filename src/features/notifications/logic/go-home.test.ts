import assert from 'node:assert/strict';
import test from 'node:test';

import { goHome, type HomeRouter } from './go-home.ts';

function spyRouter() {
  const calls: string[] = [];
  const router: HomeRouter = {
    dismissTo: (href) => { calls.push(`dismissTo ${href}`); },
    navigate: (href) => { calls.push(`navigate ${href}`); },
  };
  return { router, calls };
}

test('goes Home with dismissTo, navigate and dismissTo again, in exactly that order', () => {
  // Measured on the Samsung (expo-router 57): `dismissTo` alone is ignored when another tab is
  // focused (the Tabs navigator has no POP_TO), `navigate` alone leaves a duplicated Home `index`
  // (and a second `(tabs)` over an open scanner modal). The sequence below ends with one Home root.
  const { router, calls } = spyRouter();

  goHome(router);

  assert.deepEqual(calls, ['dismissTo /', 'navigate /', 'dismissTo /']);
});

test('every call goes to the root href and nothing else is touched', () => {
  const { router, calls } = spyRouter();

  goHome(router);

  assert.ok(calls.every((call) => call.endsWith(' /')));
  assert.equal(calls.length, 3);
});

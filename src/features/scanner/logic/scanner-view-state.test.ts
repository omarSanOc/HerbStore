import test from 'node:test';
import assert from 'node:assert/strict';

import { en } from '../../../core/i18n/resources/en.ts';
import { es } from '../../../core/i18n/resources/es.ts';
import { getScannerViewState, scannerFailureTitleKey, shouldMountScannerCamera } from './scanner-view-state.ts';

// T3b (RF-17). The old rule ("retry only after the device reconnects") left the user stuck when the
// SERVER was down but the system was connected: no reconnection event ever comes. Retry is a plain
// GET, safe to repeat, so every failed lookup offers it; connectivity only changes the wording.
test('every failed lookup offers retry, whether or not the system reported a reconnection', () => {
  for (const kind of ['offline', 'timeout', 'temporary-error', 'invalid-data'] as const) {
    assert.deepEqual(getScannerViewState({ kind, code: '4006381333931', epoch: 1 }).actions, {
      retry: true,
      cancel: true,
      rearm: false,
    }, kind);
  }
});

test('states that are not a failed lookup never offer retry', () => {
  for (const state of [
    { kind: 'preview', epoch: 0 },
    { kind: 'ready', epoch: 0 },
    { kind: 'querying', code: '4006381333931', epoch: 1 },
    { kind: 'not-found', code: '4006381333931', epoch: 1 },
    { kind: 'invalid-code', epoch: 1 },
    { kind: 'closed', epoch: 2 },
  ] as const) {
    assert.equal(getScannerViewState(state).actions.retry, false, state.kind);
  }
});

test('invalid and unavailable states expose an accessible, blocking state', () => {
  assert.equal(getScannerViewState({ kind: 'invalid-code', epoch: 1 }).blocking, true);
  assert.equal(getScannerViewState({ kind: 'unavailable', reason: 'camera', epoch: 1 }).actions.cancel, true);
});

test('granted access mounts the camera while initializing but ready waits for onCameraReady', () => {
  const mounting = { kind: 'mounting-camera', epoch: 0 } as const;
  const ready = { kind: 'ready', epoch: 0 } as const;
  assert.equal(shouldMountScannerCamera(mounting, true), true);
  assert.equal(shouldMountScannerCamera(ready, true), true);
  assert.equal(shouldMountScannerCamera(ready, false), false);

  const unavailable = { kind: 'unavailable', reason: 'permission', epoch: 0 } as const;
  assert.equal(shouldMountScannerCamera(unavailable, true), false);
});

// T4b (RF-7). The title of a failed lookup used to be composed (`scanner.${kind}`) and, for
// `temporary-error`, produced a key that does not exist (the resource is `temporaryError`): the
// screen showed the raw key. Now each failure kind names its key, and both languages must have it.
test('every failed-lookup kind names a title key that exists, as a sentence, in Spanish and English', () => {
  const kinds = ['offline', 'timeout', 'temporary-error', 'invalid-data'] as const;
  const expected = { offline: 'scanner.offline', timeout: 'scanner.timeout', 'temporary-error': 'scanner.temporaryError', 'invalid-data': 'scanner.invalidData' };
  for (const kind of kinds) {
    const key = scannerFailureTitleKey(kind);
    assert.equal(key, expected[kind]);
    for (const resources of [es, en]) {
      const text = (resources.translation.scanner as Record<string, string>)[key.slice('scanner.'.length)];
      assert.equal(typeof text, 'string', `${key} is missing`);
      assert.match(text ?? '', /\S/);
    }
  }
});

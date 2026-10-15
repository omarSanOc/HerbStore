import test from 'node:test';
import assert from 'node:assert/strict';

import { getScannerViewState, shouldMountScannerCamera } from './scanner-view-state.ts';

test('scanner actions keep offline retry disabled until connectivity returns', () => {
  assert.deepEqual(getScannerViewState({ kind: 'offline', code: '4006381333931', epoch: 1 }, false).actions, {
    retry: false,
    cancel: true,
    rearm: false,
  });
  assert.equal(getScannerViewState({ kind: 'offline', code: '4006381333931', epoch: 1 }, true).actions.retry, true);
});

test('invalid and unavailable states expose an accessible, blocking state', () => {
  assert.equal(getScannerViewState({ kind: 'invalid-code', code: 'x', epoch: 1 }, true).blocking, true);
  assert.equal(getScannerViewState({ kind: 'unavailable', reason: 'camera', epoch: 1 }, true).actions.cancel, true);
  assert.equal(getScannerViewState({ kind: 'ready', epoch: 1 }, true).announcement, 'scanner.ready');
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

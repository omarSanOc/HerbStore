import test from 'node:test';
import assert from 'node:assert/strict';

import type { ApiError } from '../../../core/api/api-error.ts';
import { initialScannerState, scannerReducer } from './scanner-machine.ts';

const code = '4006381333931';
const error = (value: ApiError) => ({ type: 'queryFinished' as const, epoch: 1, error: value });

function readyState() {
  const checking = scannerReducer(initialScannerState, { type: 'confirm' });
  const mounting = scannerReducer(checking, { type: 'permissionGranted' });
  return scannerReducer(mounting, { type: 'cameraReady' });
}

test('scanner requires preview confirmation and accepts only one reading', () => {
  const checking = scannerReducer(initialScannerState, { type: 'confirm' });
  assert.equal(checking.kind, 'checking-permission');
  const mounting = scannerReducer(checking, { type: 'permissionGranted' });
  assert.equal(mounting.kind, 'mounting-camera');
  const ready = scannerReducer(mounting, { type: 'cameraReady' });
  assert.equal(ready.kind, 'ready');
  const querying = scannerReducer(ready, { type: 'codeRead', code });
  assert.equal(querying.kind, 'querying');
  assert.equal(scannerReducer(querying, { type: 'codeRead', code }).kind, 'querying');
});

test('scanner completes navigation only after the nested detail is opened, then rearms on return', () => {
  const product = { id: 'product-261009-001' } as never;
  const navigating = scannerReducer(
    scannerReducer(
      readyState(),
      { type: 'codeRead', code: '4006381333931' },
    ),
    { type: 'queryFinished', epoch: 1, product },
  );

  assert.equal(navigating.kind, 'navigating');
  const returned = scannerReducer(navigating, { type: 'navigationSucceeded' });
  assert.equal(returned.kind, 'ready');
  assert.equal(scannerReducer(returned, { type: 'rearm' }).kind, 'ready');
});

test('scanner exposes recoverable navigation failure and ignores late navigation results after cancel', () => {
  const product = { id: 'product-261009-001' } as never;
  const navigating = { kind: 'navigating', code: '4006381333931', epoch: 2, product } as const;
  const failed = scannerReducer(navigating, { type: 'navigationFailed' });
  assert.equal(failed.kind, 'navigation-error');
  const retrying = scannerReducer(failed, { type: 'retryNavigation' });
  assert.equal(retrying.kind, 'navigating');
  const closed = scannerReducer(failed, { type: 'cancel' });
  assert.equal(closed.kind, 'closed');
  assert.equal(scannerReducer(closed, { type: 'navigationSucceeded' }).kind, 'closed');
});

test('invalid code blocks until explicit rearm', () => {
  const ready = readyState();
  const invalid = scannerReducer(ready, { type: 'invalidRead' });
  assert.equal(invalid.kind, 'invalid-code');
  assert.equal(scannerReducer(invalid, { type: 'codeRead', code }).kind, 'invalid-code');
  assert.equal(scannerReducer(invalid, { type: 'rearm' }).kind, 'ready');
});

test('epoch discards late results and cancel invalidates the attempt', () => {
  const querying = scannerReducer(
    readyState(),
    { type: 'codeRead', code },
  );
  assert.equal(querying.kind, 'querying');
  const cancelled = scannerReducer(querying, { type: 'cancel' });
  assert.equal(cancelled.kind, 'closed');
  assert.equal(scannerReducer(cancelled, { type: 'queryFinished', epoch: 1, error: { kind: 'network' } }).kind, 'closed');
});

test('query errors have distinct retryable states and 404 is not found', () => {
  const start = scannerReducer(
    readyState(),
    { type: 'codeRead', code },
  );
  assert.equal(start.kind, 'querying');
  const epoch = start.epoch;
  assert.equal(scannerReducer(start, { ...error({ kind: 'network' }), epoch }).kind, 'offline');
  assert.equal(scannerReducer(start, { ...error({ kind: 'timeout' }), epoch }).kind, 'timeout');
  assert.equal(scannerReducer(start, { ...error({ kind: 'http', status: 503 }), epoch }).kind, 'temporary-error');
  assert.equal(scannerReducer(start, { ...error({ kind: 'invalid' }), epoch }).kind, 'invalid-data');
  assert.equal(scannerReducer(start, { ...error({ kind: 'http', status: 404 }), epoch }).kind, 'not-found');
});

test('retry starts a new epoch without reopening the preview', () => {
  const querying = scannerReducer(
    readyState(),
    { type: 'codeRead', code },
  );
  assert.equal(querying.kind, 'querying');
  const offline = scannerReducer(querying, { ...error({ kind: 'network' }), epoch: querying.epoch });
  const retrying = scannerReducer(offline, { type: 'retry' });
  assert.equal(retrying.kind, 'querying');
  assert.notEqual(retrying.epoch, querying.epoch);
});

test('denied permission and CameraView mount errors converge on unavailable', () => {
  const checking = scannerReducer(initialScannerState, { type: 'confirm' });
  assert.equal(scannerReducer(checking, { type: 'permissionUnavailable', reason: 'permission' }).kind, 'unavailable');

  const mounting = scannerReducer(checking, { type: 'permissionGranted' });
  const mountFailed = scannerReducer(mounting, { type: 'cameraUnavailable', reason: 'mount failed' });
  assert.equal(mountFailed.kind, 'unavailable');
  assert.equal(mountFailed.kind === 'unavailable' ? mountFailed.reason : undefined, 'mount failed');
});

test('foreground permission revocation moves ready to unavailable and recovery waits for camera ready', () => {
  const ready = { kind: 'ready', epoch: 4 } as const;
  const unavailable = scannerReducer(ready, { type: 'permissionUnavailable', reason: 'permission' });

  assert.deepEqual(unavailable, { kind: 'unavailable', reason: 'permission', epoch: 5 });

  const mounting = scannerReducer(unavailable, { type: 'permissionGranted' });
  assert.deepEqual(mounting, { kind: 'mounting-camera', epoch: 5 });
  assert.deepEqual(scannerReducer(mounting, { type: 'cameraReady' }), { kind: 'ready', epoch: 5 });
});

test('foreground permission revocation invalidates a querying attempt and its late result', () => {
  const querying = { kind: 'querying', code, epoch: 7 } as const;
  const unavailable = scannerReducer(querying, { type: 'permissionUnavailable', reason: 'permission' });

  assert.deepEqual(unavailable, { kind: 'unavailable', reason: 'permission', epoch: 8 });
  assert.deepEqual(
    scannerReducer(unavailable, { type: 'queryFinished', epoch: 7, product: { id: 'product-261009-001' } as never }),
    unavailable,
  );
});

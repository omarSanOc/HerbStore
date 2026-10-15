import test from 'node:test';
import assert from 'node:assert/strict';

import { isCameraAvailableBeforeMount } from '../native/camera-availability.ts';
import { resolveCameraAccess } from './camera-access.ts';

test('SDK 57 native access proceeds to CameraView without an availability preflight', async () => {
  assert.equal(await isCameraAvailableBeforeMount(), true);
});

test('granted camera permission proceeds without a capability preflight or another request', async () => {
  let requests = 0;

  const result = await resolveCameraAccess({
    getPermission: async () => ({ granted: true, canAskAgain: true }),
    requestPermission: async () => {
      requests += 1;
      return { granted: true, canAskAgain: true };
    },
  }, true);

  assert.equal(result, 'granted');
  assert.equal(requests, 0);
});

test('camera permission is requested only while the normal dialog can resolve access', async () => {
  let requests = 0;

  const result = await resolveCameraAccess({
    getPermission: async () => ({ granted: false, canAskAgain: true }),
    requestPermission: async () => {
      requests += 1;
      return { granted: true, canAskAgain: true };
    },
  }, true);

  assert.equal(result, 'granted');
  assert.equal(requests, 1);
});

test('denied permission that cannot be resolved by a dialog is unavailable', async () => {
  let requests = 0;

  const result = await resolveCameraAccess({
    getPermission: async () => ({ granted: false, canAskAgain: false }),
    requestPermission: async () => {
      requests += 1;
      return { granted: true, canAskAgain: true };
    },
  }, true);

  assert.equal(result, 'unavailable');
  assert.equal(requests, 0);
});

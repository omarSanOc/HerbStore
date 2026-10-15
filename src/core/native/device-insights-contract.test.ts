/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  completeDeviceInsightsRefresh,
  createDeviceInsightsRefreshCoordinator,
  failDeviceInsightsRefresh,
  initialDeviceInsightsState,
  parseDeviceInsightsEvent,
  parseDeviceInsightsAccent,
  formatDeviceInsightsEventSummary,
  parseDeviceInsightsPayload,
  parseDevicePlatform,
  startDeviceInsightsRefresh,
} from './device-insights-contract.ts';

describe('DeviceInsights payload contract', () => {
  it('uses the primary accent for unknown view values', () => {
    assert.equal(parseDeviceInsightsAccent('primary'), 'primary');
    assert.equal(parseDeviceInsightsAccent('success'), 'success');
    assert.equal(parseDeviceInsightsAccent('warning'), 'warning');
    assert.equal(parseDeviceInsightsAccent('error'), 'error');
    assert.equal(parseDeviceInsightsAccent('danger'), 'primary');
    assert.equal(parseDeviceInsightsAccent(''), 'primary');
  });
  const validPayload = {
    platform: 'android',
    model: 'Fictional phone',
    systemVersion: '16',
    isPhysical: true,
  } as const;

  it('accepts only the two supported platform values', () => {
    assert.equal(parseDevicePlatform('android'), 'android');
    assert.equal(parseDevicePlatform('ios'), 'ios');
    for (const value of ['web', 'Android', '', null, undefined]) {
      assert.equal(parseDevicePlatform(value), undefined);
    }
  });

  it('projects a valid native payload to non-sensitive public fields', () => {
    assert.deepEqual(
      parseDeviceInsightsPayload({
        ...validPayload,
        serialNumber: 'must-not-cross-the-boundary',
        identifierForVendor: 'must-not-cross-the-boundary',
      }),
      validPayload,
    );
  });

  it('rejects malformed payloads and an empty model', () => {
    for (const payload of [
      undefined,
      null,
      {},
      { ...validPayload, platform: 'web' },
      { ...validPayload, model: '' },
      { ...validPayload, model: '   ' },
      { ...validPayload, systemVersion: '' },
      { ...validPayload, isPhysical: 'true' },
    ]) {
      assert.equal(parseDeviceInsightsPayload(payload), undefined);
    }
  });

  it('does not alias the unknown native object', () => {
    const nativePayload: Record<string, unknown> = { ...validPayload };
    const parsed = parseDeviceInsightsPayload(nativePayload);
    nativePayload.model = 'Changed later';
    assert.equal(parsed?.model, 'Fictional phone');
  });
});

describe('DeviceInsights event contract', () => {
  it('formats a localized, non-sensitive event summary', () => {
    assert.equal(
      formatDeviceInsightsEventSummary(
        {
          insights: { platform: 'ios', model: 'iPhone', systemVersion: '26.5', isPhysical: false },
          timestamp: '2026-10-13T23:59:58.123Z',
        },
        { android: 'Android', ios: 'iOS', physical: 'physical', simulator: 'simulator' },
      ),
      'iOS · iPhone · 26.5 · simulator',
    );
  });
  it('accepts a valid UTC ISO 8601 timestamp and projects the payload', () => {
    assert.deepEqual(
      parseDeviceInsightsEvent({
        platform: 'ios',
        model: 'iPhone',
        systemVersion: '26.5',
        isPhysical: false,
        timestamp: '2026-10-13T23:59:58.123Z',
        deviceId: 'must-not-cross-the-boundary',
      }),
      {
        insights: {
          platform: 'ios',
          model: 'iPhone',
          systemVersion: '26.5',
          isPhysical: false,
        },
        timestamp: '2026-10-13T23:59:58.123Z',
      },
    );
  });

  it('rejects non-UTC, impossible and non-canonical timestamps', () => {
    for (const timestamp of [
      '2026-10-13T23:59:58.123+01:00',
      '2026-10-13T23:59:58Z',
      '2026-02-30T12:00:00.000Z',
      'not-a-date',
      0,
    ]) {
      assert.equal(
        parseDeviceInsightsEvent({
          platform: 'ios',
          model: 'iPhone',
          systemVersion: '26.5',
          isPhysical: false,
          timestamp,
        }),
        undefined,
      );
    }
  });
});

describe('DeviceInsights refresh state', () => {
  it('starts from idle and ignores a concurrent refresh', () => {
    const first = startDeviceInsightsRefresh(initialDeviceInsightsState);
    assert.deepEqual(first, { outcome: 'started', state: { status: 'refreshing' } });
    assert.deepEqual(startDeviceInsightsRefresh(first.state), {
      outcome: 'ignored',
      state: first.state,
    });
  });

  it('completes with validated data or a controlled error', () => {
    assert.deepEqual(
      completeDeviceInsightsRefresh({
        platform: 'android',
        model: 'Phone',
        systemVersion: '16',
        isPhysical: true,
      }),
      {
        status: 'success',
        data: {
          platform: 'android',
          model: 'Phone',
          systemVersion: '16',
          isPhysical: true,
        },
      },
    );
    assert.deepEqual(completeDeviceInsightsRefresh({ model: '' }), {
      status: 'error',
      code: 'invalid-response',
    });
    assert.deepEqual(failDeviceInsightsRefresh(), { status: 'error', code: 'native-failure' });
  });

  it('runs one native refresh and ignores a concurrent facade request', async () => {
    let resolveNative: ((value: unknown) => void) | undefined;
    let nativeCalls = 0;
    const coordinator = createDeviceInsightsRefreshCoordinator(
      () =>
        new Promise((resolve) => {
          nativeCalls += 1;
          resolveNative = resolve;
        }),
    );

    const first = coordinator.refresh();
    assert.deepEqual(await coordinator.refresh(), { status: 'ignored' });
    assert.equal(nativeCalls, 1);

    resolveNative?.({
      platform: 'android',
      model: 'Phone',
      systemVersion: '16',
      isPhysical: true,
    });
    assert.equal((await first).status, 'success');
  });

  it('turns a native rejection into a controlled result and permits retry', async () => {
    let shouldFail = true;
    const coordinator = createDeviceInsightsRefreshCoordinator(async () => {
      if (shouldFail) throw new Error('native details must not escape');
      return { platform: 'ios', model: 'iPhone', systemVersion: '26.5', isPhysical: false };
    });

    assert.deepEqual(await coordinator.refresh(), { status: 'error', code: 'native-failure' });
    shouldFail = false;
    assert.equal((await coordinator.refresh()).status, 'success');
  });
});

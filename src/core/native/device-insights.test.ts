/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createDeviceInsightsFacade } from './device-insights.ts';

describe('DeviceInsights facade', () => {
  it('validates sync, async and event values at the native boundary', async () => {
    const listeners: ((value: unknown) => void)[] = [];
    const facade = createDeviceInsightsFacade({
      getPlatform: () => 'android',
      getInsightsAsync: async () => ({
        platform: 'android',
        model: 'Fictional phone',
        systemVersion: '16',
        isPhysical: true,
      }),
      addListener: (listener) => {
        listeners.push(listener);
        return { remove: () => listeners.splice(listeners.indexOf(listener), 1) };
      },
    });

    assert.equal(facade.getPlatform(), 'android');
    assert.deepEqual(await facade.refresh(), {
      status: 'success',
      data: {
        platform: 'android',
        model: 'Fictional phone',
        systemVersion: '16',
        isPhysical: true,
      },
    });

    const received: unknown[] = [];
    const subscription = facade.subscribe((event) => received.push(event));
    listeners[0]?.({
      platform: 'android',
      model: 'Fictional phone',
      systemVersion: '16',
      isPhysical: true,
      timestamp: '2026-10-13T23:59:58.123Z',
      serial: 'must-not-cross-the-boundary',
    });
    listeners[0]?.({ platform: 'android', model: '', systemVersion: '16', isPhysical: true });
    assert.deepEqual(received, [
      {
        insights: {
          platform: 'android',
          model: 'Fictional phone',
          systemVersion: '16',
          isPhysical: true,
        },
        timestamp: '2026-10-13T23:59:58.123Z',
      },
    ]);
    subscription.remove();
    assert.equal(listeners.length, 0);
  });

  it('returns controlled errors and ignores concurrent refreshes', async () => {
    let resolve: ((value: unknown) => void) | undefined;
    const facade = createDeviceInsightsFacade({
      getPlatform: () => 'ios',
      getInsightsAsync: () => new Promise((complete) => { resolve = complete; }),
      addListener: () => ({ remove: () => undefined }),
    });

    const first = facade.refresh();
    assert.deepEqual(await facade.refresh(), { status: 'ignored' });
    resolve?.({ platform: 'ios', model: '', systemVersion: '26.5', isPhysical: false });
    assert.deepEqual(await first, { status: 'error', code: 'invalid-response' });
  });

  it('drops late events after cleanup and does not duplicate a remounted subscription', () => {
    let nativeListener: ((value: unknown) => void) | undefined;
    let nativeRemovals = 0;
    const facade = createDeviceInsightsFacade({
      getPlatform: () => 'ios',
      getInsightsAsync: async () => undefined,
      addListener: (listener) => {
        nativeListener = listener;
        return { remove: () => { nativeRemovals += 1; } };
      },
    });
    const event = {
      platform: 'ios',
      model: 'iPhone',
      systemVersion: '26.5',
      isPhysical: false,
      timestamp: '2026-10-14T23:59:58.123Z',
    };
    const received: unknown[] = [];

    const first = facade.subscribe((value) => received.push(value));
    const staleListener = nativeListener;
    first.remove();
    first.remove();
    staleListener?.(event);

    const second = facade.subscribe((value) => received.push(value));
    nativeListener?.(event);
    assert.equal(received.length, 1);
    assert.equal(nativeRemovals, 1);
    second.remove();
    assert.equal(nativeRemovals, 2);
  });
});

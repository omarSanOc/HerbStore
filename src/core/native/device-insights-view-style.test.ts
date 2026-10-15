/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  resolveDeviceInsightsMinimumHeight,
  resolveDeviceInsightsViewStyle,
} from './device-insights-view-style.ts';

const palette = {
  primary: '#176B45',
  success: '#187F48',
  warning: '#7A4A00',
  error: '#A52A2A',
} as const;

describe('DeviceInsights native view color', () => {
  it('resolves every closed accent token to its JS theme color', () => {
    for (const accent of ['primary', 'success', 'warning', 'error'] as const) {
      assert.deepEqual(resolveDeviceInsightsViewStyle(accent, palette), {
        accent,
        accentColor: palette[accent],
      });
    }
  });

  it('falls back to the primary JS token for an unknown accent or invalid semantic color', () => {
    assert.deepEqual(resolveDeviceInsightsViewStyle('danger', palette), {
      accent: 'primary',
      accentColor: palette.primary,
    });
    assert.deepEqual(resolveDeviceInsightsViewStyle('success', { ...palette, success: 'green' }), {
      accent: 'primary',
      accentColor: palette.primary,
    });
  });

  it('omits an invalid color when even the primary token is malformed', () => {
    assert.deepEqual(resolveDeviceInsightsViewStyle('primary', { ...palette, primary: '#12' }), {
      accent: 'primary',
      accentColor: undefined,
    });
  });

  it('grows the native target with the system font scale without going below 48', () => {
    assert.equal(resolveDeviceInsightsMinimumHeight(0.8), 48);
    assert.equal(resolveDeviceInsightsMinimumHeight(1), 48);
    assert.equal(resolveDeviceInsightsMinimumHeight(2), 96);
    assert.equal(resolveDeviceInsightsMinimumHeight(3.57), 172);
    assert.equal(resolveDeviceInsightsMinimumHeight(Number.NaN), 48);
  });
});

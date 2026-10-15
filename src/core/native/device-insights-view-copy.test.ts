import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveDeviceInsightsViewCopy } from './device-insights-view-copy.ts';

test('an empty label uses the localized JS fallback and localized available state', () => {
  assert.deepEqual(resolveDeviceInsightsViewCopy('', {
    fallbackLabel: 'Refresh information',
    available: 'Available',
    unavailable: 'Unavailable',
    refreshing: 'Refreshing',
  }, { available: true, refreshing: false }), {
    label: 'Refresh information',
    state: 'Available',
  });
});

test('refreshing and unavailable states come from the active JS language', () => {
  const copy = {
    fallbackLabel: 'Actualizar información',
    available: 'Disponible',
    unavailable: 'No disponible',
    refreshing: 'Actualizando',
  };
  assert.equal(resolveDeviceInsightsViewCopy('Actualizar', copy, { available: true, refreshing: true }).state, 'Actualizando');
  assert.equal(resolveDeviceInsightsViewCopy('Actualizar', copy, { available: false, refreshing: false }).state, 'No disponible');
});

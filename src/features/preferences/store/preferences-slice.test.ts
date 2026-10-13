/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  currencyChanged,
  preferencesReducer,
  selectPreferredCurrency,
} from './preferences-slice.ts';

const init = { type: '@@INIT' };

describe('preferences slice (Day 4: only the currency, in memory)', () => {
  it('starts in MXN', () => {
    assert.deepEqual(preferencesReducer(undefined, init), { currency: 'MXN' });
  });

  it('currencyChanged switches the preferred currency', () => {
    const usd = preferencesReducer(undefined, currencyChanged('USD'));
    assert.deepEqual(usd, { currency: 'USD' });
    assert.deepEqual(preferencesReducer(usd, currencyChanged('MXN')), { currency: 'MXN' });
  });

  it('choosing the current currency again returns the very same state', () => {
    const state = preferencesReducer(undefined, init);
    assert.equal(preferencesReducer(state, currencyChanged('MXN')), state);
  });

  it('ignores a payload that is not a supported currency (state comes from user code, not types)', () => {
    const state = preferencesReducer(undefined, init);
    assert.equal(preferencesReducer(state, currencyChanged('EUR' as never)), state);
    assert.equal(preferencesReducer(state, currencyChanged(undefined as never)), state);
  });

  it('does not mutate the previous state', () => {
    const before = preferencesReducer(undefined, init);
    const snapshot = structuredClone(before);
    preferencesReducer(before, currencyChanged('USD'));
    assert.deepEqual(before, snapshot);
  });

  it('selectPreferredCurrency reads it', () => {
    assert.equal(selectPreferredCurrency({ preferences: { currency: 'USD' } }), 'USD');
  });
});

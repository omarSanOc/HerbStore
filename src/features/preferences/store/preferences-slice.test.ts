/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  currencyChanged,
  languageChanged,
  preferencesReducer,
  selectLanguagePreference,
  selectPreferredCurrency,
  selectThemePreference,
  themeChanged,
} from './preferences-slice.ts';

const init = { type: '@@INIT' };

describe('preferences slice (language, currency and theme; persisted since Day 6)', () => {
  it('starts with no language chosen, MXN and the system theme', () => {
    const state = preferencesReducer(undefined, init);
    assert.deepEqual(state, { currency: 'MXN', theme: 'system' });
    assert.equal('language' in state, false);
  });

  it('currencyChanged switches the preferred currency', () => {
    const usd = preferencesReducer(undefined, currencyChanged('USD'));
    assert.deepEqual(usd, { currency: 'USD', theme: 'system' });
    assert.deepEqual(preferencesReducer(usd, currencyChanged('MXN')), { currency: 'MXN', theme: 'system' });
  });

  it('languageChanged records the choice; themeChanged records the theme', () => {
    const english = preferencesReducer(undefined, languageChanged('en'));
    assert.deepEqual(english, { language: 'en', currency: 'MXN', theme: 'system' });
    assert.deepEqual(preferencesReducer(english, themeChanged('dark')), { language: 'en', currency: 'MXN', theme: 'dark' });
  });

  it('the three preferences are independent of each other', () => {
    let state = preferencesReducer(undefined, init);
    state = preferencesReducer(state, languageChanged('en'));
    state = preferencesReducer(state, currencyChanged('USD'));
    state = preferencesReducer(state, themeChanged('light'));
    state = preferencesReducer(state, languageChanged('es'));
    assert.deepEqual(state, { language: 'es', currency: 'USD', theme: 'light' });
  });

  it('choosing the current value again returns the very same state', () => {
    const state = preferencesReducer(preferencesReducer(undefined, languageChanged('en')), themeChanged('dark'));
    assert.equal(preferencesReducer(state, currencyChanged('MXN')), state);
    assert.equal(preferencesReducer(state, languageChanged('en')), state);
    assert.equal(preferencesReducer(state, themeChanged('dark')), state);
  });

  it('ignores a payload that is not supported (state comes from user code, not types)', () => {
    const state = preferencesReducer(undefined, init);
    assert.equal(preferencesReducer(state, currencyChanged('EUR' as never)), state);
    assert.equal(preferencesReducer(state, currencyChanged(undefined as never)), state);
    assert.equal(preferencesReducer(state, languageChanged('fr' as never)), state);
    assert.equal(preferencesReducer(state, languageChanged('EN' as never)), state);
    assert.equal(preferencesReducer(state, themeChanged('sepia' as never)), state);
    assert.equal(preferencesReducer(state, themeChanged(undefined as never)), state);
  });

  it('does not mutate the previous state', () => {
    const before = preferencesReducer(undefined, init);
    const snapshot = structuredClone(before);
    preferencesReducer(before, currencyChanged('USD'));
    preferencesReducer(before, languageChanged('en'));
    preferencesReducer(before, themeChanged('dark'));
    assert.deepEqual(before, snapshot);
  });

  it('the selectors read each preference', () => {
    const state = { preferences: { language: 'en', currency: 'USD', theme: 'dark' } } as const;
    assert.equal(selectPreferredCurrency(state), 'USD');
    assert.equal(selectLanguagePreference(state), 'en');
    assert.equal(selectThemePreference(state), 'dark');
    assert.equal(selectLanguagePreference({ preferences: {} }), undefined);
  });
});

/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_PREFERENCES,
  isThemePreference,
  resolveColorScheme,
  restorePreferences,
  toNativeColorScheme,
} from './preferences.ts';

describe('DEFAULT_PREFERENCES', () => {
  it('has no language (= the device language), MXN and a theme that follows the system', () => {
    assert.deepEqual(DEFAULT_PREFERENCES, { currency: 'MXN', theme: 'system' });
    assert.equal('language' in DEFAULT_PREFERENCES, false);
  });
});

describe('restorePreferences (a stored value is judged field by field)', () => {
  it('restores a valid state as it is', () => {
    assert.deepEqual(restorePreferences({ language: 'en', currency: 'USD', theme: 'dark' }), { language: 'en', currency: 'USD', theme: 'dark' });
    assert.deepEqual(restorePreferences({ language: 'es', currency: 'MXN', theme: 'light' }), { language: 'es', currency: 'MXN', theme: 'light' });
  });

  it('a language that was never chosen stays absent (the device language is NOT written as a choice)', () => {
    const restored = restorePreferences({ currency: 'USD', theme: 'dark' });
    assert.deepEqual(restored, { currency: 'USD', theme: 'dark' });
    assert.equal('language' in restored, false);
  });

  for (const [label, stored] of [
    ['missing', undefined],
    ['null', null],
    ['a string', 'dark'],
    ['a number', 7],
    ['an array', ['en', 'USD', 'dark']],
    ['an empty object', {}],
  ] as const) {
    it(`a slice that is ${label} gives the defaults`, () => {
      assert.deepEqual(restorePreferences(stored), DEFAULT_PREFERENCES);
    });
  }

  it('an invalid field falls back alone: the valid ones stay', () => {
    assert.deepEqual(restorePreferences({ language: 'en', currency: 'EUR', theme: 'dark' }), { language: 'en', currency: 'MXN', theme: 'dark' });
    assert.deepEqual(restorePreferences({ language: 'en', currency: 'USD', theme: 'sepia' }), { language: 'en', currency: 'USD', theme: 'system' });
    assert.deepEqual(restorePreferences({ language: 'fr', currency: 'USD', theme: 'dark' }), { currency: 'USD', theme: 'dark' });
  });

  it('is strict: no case folding, no trimming, no region codes, no wrong types', () => {
    for (const language of ['EN', 'en-US', ' en', 'english', 1, true, null, {}, ['en']]) {
      assert.equal('language' in restorePreferences({ language }), false, String(language));
    }
    for (const currency of ['usd', 'USD ', 'mxn', 1, null]) {
      assert.equal(restorePreferences({ currency }).currency, 'MXN', String(currency));
    }
    for (const theme of ['DARK', 'Dark', 'auto', 'automatic', 0, null, undefined]) {
      assert.equal(restorePreferences({ theme }).theme, 'system', String(theme));
    }
  });

  it('keeps nothing but the three preferences (no extra field a build might have stored)', () => {
    const restored = restorePreferences({ language: 'en', currency: 'USD', theme: 'dark', email: 'person@example.test', extra: 1 });
    assert.deepEqual(Object.keys(restored).sort(), ['currency', 'language', 'theme']);
  });

  it('does not read inherited properties', () => {
    const stored = Object.create({ language: 'en', currency: 'USD', theme: 'dark' });
    assert.deepEqual(restorePreferences(stored), DEFAULT_PREFERENCES);
  });
});

describe('isThemePreference', () => {
  it('accepts exactly system, light and dark', () => {
    for (const value of ['system', 'light', 'dark']) assert.equal(isThemePreference(value), true);
    for (const value of ['', 'auto', 'System', undefined, null, 1]) assert.equal(isThemePreference(value), false);
  });
});

describe('resolveColorScheme (the scheme the UI draws)', () => {
  it('a forced theme wins over the system, whatever the system says', () => {
    for (const system of ['light', 'dark', null, undefined, 'unspecified'] as const) {
      assert.equal(resolveColorScheme('light', system), 'light');
      assert.equal(resolveColorScheme('dark', system), 'dark');
    }
  });

  it('system follows the system scheme; unknown means light', () => {
    assert.equal(resolveColorScheme('system', 'dark'), 'dark');
    assert.equal(resolveColorScheme('system', 'light'), 'light');
    assert.equal(resolveColorScheme('system', null), 'light');
    assert.equal(resolveColorScheme('system', undefined), 'light');
    assert.equal(resolveColorScheme('system', 'unspecified'), 'light');
  });
});

describe('toNativeColorScheme (what Appearance.setColorScheme receives)', () => {
  it('maps system to unspecified (hand the control back to the OS)', () => {
    assert.equal(toNativeColorScheme('system'), 'unspecified');
    assert.equal(toNativeColorScheme('light'), 'light');
    assert.equal(toNativeColorScheme('dark'), 'dark');
  });
});

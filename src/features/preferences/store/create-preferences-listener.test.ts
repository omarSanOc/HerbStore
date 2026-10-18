/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { configureStore, type UnknownAction } from '@reduxjs/toolkit';
import { REHYDRATE } from 'redux-persist';

import { createPreferencesListener } from './create-preferences-listener.ts';
import { currencyChanged, languageChanged, preferencesReducer, themeChanged } from './preferences-slice.ts';

type Applied = { language: string[]; scheme: string[] };

/** A bare store: the real preferences slice and a REHYDRATE that restores it, like redux-persist does. */
function setup(ports?: Partial<{ applyLanguage: (language: 'es' | 'en') => void; applyColorScheme: (scheme: 'light' | 'dark' | 'unspecified') => void }>) {
  const applied: Applied = { language: [], scheme: [] };
  const listener = createPreferencesListener({
    applyLanguage: (language) => {
      applied.language.push(language);
      ports?.applyLanguage?.(language);
    },
    applyColorScheme: (scheme) => {
      applied.scheme.push(scheme);
      ports?.applyColorScheme?.(scheme);
    },
  });
  const store = configureStore({
    reducer: (state: { preferences: ReturnType<typeof preferencesReducer> } | undefined, action: UnknownAction & { payload?: { preferences?: never } }) => {
      const current = state ?? { preferences: preferencesReducer(undefined, { type: '@@INIT' }) };
      if (action.type === REHYDRATE) return { preferences: action.payload?.preferences ?? current.preferences };
      return { preferences: preferencesReducer(current.preferences, action) };
    },
    middleware: (getDefault) => getDefault({ serializableCheck: false }).prepend(listener.middleware),
  });
  const rehydrate = (preferences: unknown) => store.dispatch({ type: REHYDRATE, key: 'root', payload: { preferences } });
  return { store, applied, rehydrate };
}

describe('preferences listener (applies the choice to i18n and to the native appearance)', () => {
  it('after rehydrating a chosen language and theme it applies both', () => {
    const { applied, rehydrate } = setup();
    rehydrate({ language: 'en', currency: 'USD', theme: 'dark' });
    assert.deepEqual(applied, { language: ['en'], scheme: ['dark'] });
  });

  it('after rehydrating the defaults it applies nothing: the device language and the OS theme already rule', () => {
    const { applied, rehydrate } = setup();
    rehydrate({ currency: 'MXN', theme: 'system' });
    assert.deepEqual(applied, { language: [], scheme: [] });
  });

  it('a language without a forced theme only applies the language (and the reverse)', () => {
    const first = setup();
    first.rehydrate({ language: 'es', currency: 'MXN', theme: 'system' });
    assert.deepEqual(first.applied, { language: ['es'], scheme: [] });

    const second = setup();
    second.rehydrate({ currency: 'MXN', theme: 'light' });
    assert.deepEqual(second.applied, { language: [], scheme: ['light'] });
  });

  it('a rehydration with no stored state applies nothing', () => {
    const { applied, store } = setup();
    store.dispatch({ type: REHYDRATE, key: 'root', payload: undefined });
    assert.deepEqual(applied, { language: [], scheme: [] });
  });

  it('languageChanged applies the new language once; currencyChanged applies neither', () => {
    const { applied, store } = setup();
    store.dispatch(languageChanged('en'));
    store.dispatch(currencyChanged('USD'));
    assert.deepEqual(applied, { language: ['en'], scheme: [] });
  });

  it('themeChanged applies the native scheme, and system hands the control back (unspecified)', () => {
    const { applied, store } = setup();
    store.dispatch(themeChanged('dark'));
    store.dispatch(themeChanged('light'));
    store.dispatch(themeChanged('system'));
    assert.deepEqual(applied.scheme, ['dark', 'light', 'unspecified']);
    assert.deepEqual(applied.language, []);
  });

  it('choosing the same value again applies nothing', () => {
    const { applied, store } = setup();
    store.dispatch(languageChanged('en'));
    store.dispatch(languageChanged('en'));
    store.dispatch(themeChanged('system'));
    assert.deepEqual(applied, { language: ['en'], scheme: [] });
  });

  it('a rapid sequence applies each change in order, so the LAST choice is the final state', () => {
    const { applied, store } = setup();
    for (const language of ['en', 'es', 'en'] as const) store.dispatch(languageChanged(language));
    assert.deepEqual(applied.language, ['en', 'es', 'en']);
    assert.equal(store.getState().preferences.language, 'en');
  });

  it('a port that throws never breaks the dispatch nor the other port', () => {
    const { applied, store } = setup({
      applyLanguage: () => {
        throw new Error('i18n failed');
      },
    });
    store.dispatch(languageChanged('en'));
    store.dispatch(themeChanged('dark'));
    assert.equal(store.getState().preferences.language, 'en');
    assert.deepEqual(applied, { language: ['en'], scheme: ['dark'] });
  });
});

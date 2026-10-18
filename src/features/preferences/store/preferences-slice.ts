import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { isSupportedLanguage, type SupportedLanguage } from '../../../core/i18n/languages.ts';
import type { CurrencyCode } from '../../product/contracts/catalog-product.ts';
import { isCurrencyCode } from '../logic/currency.ts';
import { DEFAULT_PREFERENCES, isThemePreference, type Preferences, type ThemePreference } from '../logic/preferences.ts';

type PreferencesState = Preferences;

/**
 * The user's preferences as CLIENT state in the global store, and the only source of truth for
 * them: language, currency and theme (spec 006, RF-8, RF-9, RF-10). Since Day 6 the slice is in
 * `PERSISTED_KEYS`, so a choice survives the process; `restorePreferences` validates what comes
 * back from disk, field by field.
 *
 * - `language` is ABSENT until the user picks one (then the app speaks the device language). The
 *   i18n instance is not written here: `preferences-listeners.ts` applies the choice.
 * - Changing the currency never touches the canonical value of any amount: it only changes the
 *   currency the views convert to (`toDisplayCents`).
 * - Every reducer ignores a value that is not supported, because the type is a compile-time promise
 *   and these values also come from a persisted setting.
 *
 * Compose: a `MutableStateFlow<Preferences>` backed by DataStore in an app-scoped `ViewModel`.
 * SwiftUI: an `@Observable` settings object over `@AppStorage`.
 */
const preferencesSlice = createSlice({
  name: 'preferences',
  initialState: DEFAULT_PREFERENCES as PreferencesState,
  reducers: {
    languageChanged(state, action: PayloadAction<SupportedLanguage>) {
      if (!isSupportedLanguage(action.payload) || action.payload === state.language) {
        return state;
      }
      return { ...state, language: action.payload };
    },
    currencyChanged(state, action: PayloadAction<CurrencyCode>) {
      if (!isCurrencyCode(action.payload) || action.payload === state.currency) {
        return state;
      }
      return { ...state, currency: action.payload };
    },
    themeChanged(state, action: PayloadAction<ThemePreference>) {
      if (!isThemePreference(action.payload) || action.payload === state.theme) {
        return state;
      }
      return { ...state, theme: action.payload };
    },
  },
});

export const { currencyChanged, languageChanged, themeChanged } = preferencesSlice.actions;
export const preferencesReducer = preferencesSlice.reducer;

export const selectPreferredCurrency = (state: Readonly<{ preferences: Pick<Preferences, 'currency'> }>): CurrencyCode =>
  state.preferences.currency;

/** `undefined` = never chosen (the device language applies). */
export const selectLanguagePreference = (state: Readonly<{ preferences: Pick<Preferences, 'language'> }>): SupportedLanguage | undefined =>
  state.preferences.language;

export const selectThemePreference = (state: Readonly<{ preferences: Pick<Preferences, 'theme'> }>): ThemePreference => state.preferences.theme;

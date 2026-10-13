import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { RootState } from '@/core/store/store';

import type { CurrencyCode } from '../../product/contracts/catalog-product.ts';
import { isCurrencyCode } from '../logic/currency.ts';

type PreferencesState = Readonly<{
  /** The currency every price is shown in (spec 004, RF-5). */
  currency: CurrencyCode;
}>;

const initialState: PreferencesState = { currency: 'MXN' };

/**
 * The user's preferences as CLIENT state in the global store. Day 4 only has the currency, and it
 * lives in MEMORY on purpose: it is NOT in `PERSISTED_KEYS` (its persistence, with language and
 * theme, belongs to Day 6), so the app starts in MXN after a restart.
 *
 * Changing it never touches the canonical value of any amount: it only changes the currency the
 * views convert to (`toDisplayCents`). The reducer ignores a code that is not supported, because
 * the type is a compile-time promise and this value will also come from a persisted setting later.
 *
 * Compose: a `MutableStateFlow<Currency>` in an app-scoped `ViewModel` (later DataStore).
 * SwiftUI: an `@Observable` settings object (later `@AppStorage`).
 */
const preferencesSlice = createSlice({
  name: 'preferences',
  initialState,
  reducers: {
    currencyChanged(state, action: PayloadAction<CurrencyCode>) {
      if (!isCurrencyCode(action.payload) || action.payload === state.currency) {
        return state;
      }
      return { currency: action.payload };
    },
  },
});

export const { currencyChanged } = preferencesSlice.actions;
export const preferencesReducer = preferencesSlice.reducer;

export const selectPreferredCurrency = (state: Pick<RootState, 'preferences'>): CurrencyCode =>
  state.preferences.currency;

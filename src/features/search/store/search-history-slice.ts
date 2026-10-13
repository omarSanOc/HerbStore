import { createSlice, current, type PayloadAction } from '@reduxjs/toolkit';

import type { RootState } from '@/core/store/store';

import {
  addSearch,
  clearHistory,
  EMPTY_SEARCH_HISTORY,
  removeSearch,
  type SearchHistory,
} from '../logic/search-history';

type SearchHistoryState = Readonly<{
  /** Visible texts, newest first (the rules live in `search-history.ts`). */
  entries: SearchHistory;
}>;

const initialState: SearchHistoryState = { entries: EMPTY_SEARCH_HISTORY };

/**
 * The search history as CLIENT state in the global store. Each reducer only delegates to a pure
 * function of `search-history.ts` (identity, order, limit and "never mutate" are tested there).
 * Those functions already return new arrays, so the reducers return the next state instead of
 * editing Immer's draft.
 *
 * It is persisted (Day 4, T1): the store is global, so it survives leaving the search screen, and
 * redux-persist + MMKV keep it across restarts. It is in the explicit whitelist of
 * `core/storage/persist-policy.ts`, and `restoreSearchHistory` validates it on the way back with
 * the same rules (a corrupt history becomes empty). The rules above did not change. The `api`
 * slice (server cache) is never persisted.
 *
 * Compose: a `StateFlow<List<String>>` in a repository/`ViewModel` scoped to the app (and later
 * DataStore); SwiftUI: an `@Observable` store injected with `.environment` (and later
 * `UserDefaults`/`@AppStorage`).
 */
const searchHistorySlice = createSlice({
  name: 'searchHistory',
  initialState,
  reducers: {
    // Each reducer RETURNS the next state: the pure function already built it, so no Immer draft
    // is edited (and `current` hands the rules a plain snapshot, never a draft proxy).
    searchSent(state, action: PayloadAction<string>) {
      return { entries: addSearch(current(state).entries, action.payload) };
    },
    searchRemoved(state, action: PayloadAction<string>) {
      return { entries: removeSearch(current(state).entries, action.payload) };
    },
    historyCleared(state) {
      return { entries: clearHistory(current(state).entries) };
    },
  },
});

export const { searchSent, searchRemoved, historyCleared } = searchHistorySlice.actions;
export const searchHistoryReducer = searchHistorySlice.reducer;

export const selectSearchHistory = (state: RootState): SearchHistory =>
  state.searchHistory.entries;

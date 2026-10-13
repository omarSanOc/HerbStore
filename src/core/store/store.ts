import { configureStore } from '@reduxjs/toolkit';

import { baseApi } from '@/core/api/base-api';
import { searchHistoryReducer } from '@/features/search/store/search-history-slice';

/**
 * The single Redux store: the RTK Query cache (server state) and the search history (client state,
 * T12, in memory). Cart and the rest of the client state are added as ordinary slices later.
 * Nothing is persisted yet: redux-persist and MMKV arrive on Day 4, which whitelists
 * `searchHistory` (and the cart) but never the `api` slice.
 *
 * `setupListeners` is intentionally NOT called: it only wires `refetchOnFocus`/`refetchOnReconnect`,
 * which are disabled in `baseApi`.
 */
export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
    searchHistory: searchHistoryReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

import { combineReducers, configureStore } from '@reduxjs/toolkit';
import {
  FLUSH,
  PAUSE,
  PERSIST,
  persistReducer,
  persistStore,
  PURGE,
  REGISTER,
  REHYDRATE,
} from 'redux-persist';

import { baseApi } from '@/core/api/base-api';
import { mmkvPersistStorage } from '@/core/storage/mmkv-storage';
import { createPersistConfig } from '@/core/storage/persist-policy';
import { cartReducer } from '@/features/cart/store/cart-slice';
import { preferencesReducer } from '@/features/preferences/store/preferences-slice';
import { searchHistoryReducer } from '@/features/search/store/search-history-slice';
import { checkoutAttemptReducer } from '@/features/checkout/store/checkout-attempt-slice';
import { orderHistoryReducer } from '@/features/orders/store/order-history-slice';
import { checkoutListenerMiddleware } from '@/features/checkout/store/checkout-listeners';
import { nativeFeedbackListenerMiddleware } from '@/features/feedback/store/native-feedback-listeners';
import { orderNotificationListenerMiddleware } from '@/features/notifications/store/order-notification-listener';

/**
 * The single Redux store: the RTK Query cache (server state) and the client state slices.
 *
 * Persistence (Day 4): the root reducer is wrapped by `persistReducer` with the explicit whitelist
 * of `persist-policy.ts` (today `searchHistory` and `cart`). The `api` slice is NEVER persisted:
 * it is server state that RTK Query revalidates. Neither is `preferences` (the preferred currency
 * lives in memory until Day 6). On the way back, `migrate` sanitizes every slice, so an empty,
 * corrupt or incompatible stored state starts from the initial state.
 *
 * `setupListeners` is intentionally NOT called: it only wires `refetchOnFocus`/`refetchOnReconnect`,
 * which are disabled in `baseApi`.
 */
const rootReducer = combineReducers({
  [baseApi.reducerPath]: baseApi.reducer,
  searchHistory: searchHistoryReducer,
  cart: cartReducer,
  preferences: preferencesReducer,
  checkoutAttempt: checkoutAttemptReducer,
  orderHistory: orderHistoryReducer,
});

export const store = configureStore({
  reducer: persistReducer(
    createPersistConfig<ReturnType<typeof rootReducer>>(mmkvPersistStorage),
    rootReducer,
  ),
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // redux-persist's own actions carry callbacks (`register`, `rehydrate`, `result`): they are
      // not state and never reach a reducer's stored value, so the check skips only them.
      serializableCheck: { ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER] },
    })
      .prepend(checkoutListenerMiddleware.middleware, nativeFeedbackListenerMiddleware.middleware, orderNotificationListenerMiddleware.middleware)
      .concat(baseApi.middleware),
});

/** Starts the rehydration (reads MMKV once) and keeps writing the whitelisted slices. */
export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export type AppStore = typeof store;

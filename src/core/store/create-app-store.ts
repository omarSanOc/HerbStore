import { combineReducers, configureStore } from '@reduxjs/toolkit';
import {
  FLUSH,
  PAUSE,
  PERSIST,
  persistReducer,
  PURGE,
  REGISTER,
  REHYDRATE,
  type Storage,
} from 'redux-persist';

import { baseApi } from '@/core/api/base-api';
import { createPersistConfig } from '@/core/storage/persist-policy';
import { cartReducer } from '@/features/cart/store/cart-slice';
import { preferencesReducer } from '@/features/preferences/store/preferences-slice';
import { searchHistoryReducer } from '@/features/search/store/search-history-slice';
import { checkoutAttemptReducer } from '@/features/checkout/store/checkout-attempt-slice';
import { orderHistoryReducer } from '@/features/orders/store/order-history-slice';
import { checkoutListenerMiddleware } from '@/features/checkout/store/checkout-listeners';
import { nativeFeedbackListenerMiddleware } from '@/features/feedback/store/native-feedback-listeners';
import { orderNotificationListenerMiddleware } from '@/features/notifications/store/order-notification-listener';
import { preferencesListenerMiddleware } from '@/features/preferences/store/preferences-listeners';

/**
 * The single Redux store: the RTK Query cache (server state) and the client state slices.
 *
 * Persistence (Day 4, Day 6): the root reducer is wrapped by `persistReducer` with the explicit
 * whitelist of `persist-policy.ts` (`searchHistory`, `cart`, `checkoutAttempt`, `orderHistory` and
 * `preferences`). The `api` slice is NEVER persisted: it is server state that RTK Query revalidates.
 * On the way back, `migrate` sanitizes every slice, so an empty, corrupt or incompatible stored state
 * starts from the initial state.
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

type CreateAppStoreOptions = Readonly<{
  /** The redux-persist engine: MMKV in the app, an in-memory one in tests. */
  storage: Storage;
  /** Initial state (a test seeds a cart, an attempt, ...). Not validated: it is the caller's. */
  preloadedState?: Partial<ReturnType<typeof rootReducer>>;
  /**
   * redux-persist arms a timer (5 s by default) that it never clears, which keeps a test process
   * alive. Tests pass `0` to disable it; the app leaves it unset and keeps the library default.
   */
  persistTimeoutMs?: number;
}>;

/**
 * Builds a store. It never touches the disk by itself: `persistStore(store)` is what starts reading
 * `storage`, so a store that is not persisted stays "not rehydrated" (`selectIsRehydrated` is
 * `false`), which is exactly the locked-cart state a test may want. The app creates ONE store with
 * MMKV (`store.ts`); every test creates its own with an in-memory storage (`src/test`).
 *
 * Kept apart from `store.ts` so importing it does not load `react-native-mmkv` (a native module).
 */
export function createAppStore({ storage, preloadedState, persistTimeoutMs }: CreateAppStoreOptions) {
  const persistConfig = createPersistConfig<ReturnType<typeof rootReducer>>(storage);
  const reducer = persistReducer(
    persistTimeoutMs === undefined ? persistConfig : { ...persistConfig, timeout: persistTimeoutMs },
    rootReducer,
  );

  return configureStore({
    reducer,
    // redux-persist adds `_persist` itself when `persistStore` starts, so a seed never carries it.
    preloadedState: preloadedState as Partial<ReturnType<typeof reducer>> as ReturnType<typeof reducer> | undefined,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        // redux-persist's own actions carry callbacks (`register`, `rehydrate`, `result`): they are
        // not state and never reach a reducer's stored value, so the check skips only them.
        serializableCheck: { ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER] },
      })
        .prepend(
          checkoutListenerMiddleware.middleware,
          nativeFeedbackListenerMiddleware.middleware,
          orderNotificationListenerMiddleware.middleware,
          preferencesListenerMiddleware.middleware,
        )
        .concat(baseApi.middleware),
  });
}

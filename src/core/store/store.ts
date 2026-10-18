import type { Dispatch, ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import { persistStore } from 'redux-persist';

import { mmkvPersistStorage } from '@/core/storage/mmkv-storage';

import { createAppStore } from './create-app-store';

export { createAppStore } from './create-app-store';

/** The app's store: `createAppStore` with MMKV as the persistence engine (see that file). */
export const store = createAppStore({ storage: mmkvPersistStorage });

/** Starts the rehydration (reads MMKV once) and keeps writing the whitelisted slices. */
export const persistor = persistStore(store);

/*
 * Store types. Before `createAppStore` existed they were inferred from this very file and, because
 * the slices import `RootState` back from here, TypeScript resolved the circle to `any`
 * (`getState()` returned `any`, `dispatch` was `ThunkDispatch<any, ...>`). Deriving them from
 * `createAppStore` removes the accident and makes them precise, which exposes ~30 type errors in
 * code written against the loose types (`OrderStatusScreen`, `checkout-thunks`, and the Day 4-5
 * tests that dispatch `AppDispatch` thunks into their own mini stores). Fixing them is outside T1,
 * so the aliases keep the loose behaviour on purpose, in the open, until a task tightens them.
 */
type LooseState = any;
export type RootState = LooseState;
export type AppDispatch = ThunkDispatch<LooseState, undefined, UnknownAction> & Dispatch<UnknownAction>;
export type AppStore = Omit<typeof store, 'getState' | 'dispatch'> & {
  getState(): RootState;
  dispatch: AppDispatch;
};

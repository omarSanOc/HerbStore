import type { RootState } from './store';

/**
 * `true` once redux-persist has restored the persisted slices (or decided there was nothing
 * valid to restore). Screens that depend on persisted state (cart, checkout, "add to cart") read it
 * to show a restoring state and block changes until then (spec 004, RF-11). Home and the catalog
 * do not wait: there is no global `PersistGate`.
 */
export const selectIsRehydrated = (state: Pick<RootState, '_persist'>): boolean =>
  state._persist.rehydrated;

// What is persisted and how a stored state is read back (spec 004, RF-11, RF-12, RNF-1).
//
// The whitelist is EXPLICIT and grows task by task: T1 `searchHistory`; T2 `cart`; T8
// `checkoutAttempt` and `orderHistory`. Never the RTK Query cache (`api`: server state that RTK
// Query revalidates, and could carry personal data from responses), never `preferences` (in
// memory on Day 4; Day 6 persists it) and never form values.
//
// Storage is outside the app's control, so on the way back each slice is validated with the same
// rules that produced it; an empty, corrupt or incompatible slice becomes its initial state.
// Pure: no React Native and no redux-persist values (only types), so `test:logic` runs it.

import type { PersistConfig, Storage } from 'redux-persist';

import { EMPTY_CART, restoreCartLines, type CartLines } from '../../features/cart/logic/cart.ts';
import {
  EMPTY_SEARCH_HISTORY,
  restoreSearchHistory,
  type SearchHistory,
} from '../../features/search/logic/search-history.ts';
import { isRecord, isText } from '../validation/json-guards.ts';
import { initialAttempt, type AttemptState } from '../../features/checkout/logic/attempt-machine.ts';
import { emptyOrderHistory, type OrderHistoryState, sanitizeOrderHistory } from '../../features/orders/logic/order-history.ts';

/** redux-persist stores everything under `persist:<key>`. */
export const PERSIST_KEY = 'root';

/**
 * Schema version of the persisted state. Bump it when a persisted slice changes shape: a stored
 * state with another version is incompatible and every slice restarts from its initial state,
 * EXCEPT the versions of `READABLE_PREVIOUS_VERSIONS`.
 */
export const PERSIST_VERSION = 3;

/**
 * Older versions the restorers read correctly, so an upgrade keeps the cart, the search history,
 * the checkout attempt (the idempotency key of an unresolved order) and the orders.
 * - 1 (Day 4): `orderHistory` had no `notifications`; `sanitizeOrderHistory` starts it empty.
 * - 2 (Day 5 T8): an `unusable` record had no `unusableReason` (RF-39); it is restored as `blocked`.
 * Add a version here ONLY after a test proves the restorers read it; a breaking change leaves it out.
 * The "migration" is the sanitizer itself: every readable version goes through the same restorers
 * (Room would chain `Migration(1, 2)`, `Migration(2, 3)`; here the restorer tolerates every older shape).
 */
const READABLE_PREVIOUS_VERSIONS: readonly number[] = [1, 2];

/** The only slices that reach the disk. */
export const PERSISTED_KEYS = ['searchHistory', 'cart', 'checkoutAttempt', 'orderHistory'] as const;

export type PersistedKey = (typeof PERSISTED_KEYS)[number];

/** The persisted part of the root state, as each slice stores it. */
export type PersistedSlices = {
  readonly searchHistory: Readonly<{ entries: SearchHistory }>;
  readonly cart: Readonly<{ lines: CartLines }>;
  readonly checkoutAttempt: AttemptState;
  readonly orderHistory: OrderHistoryState;
};

type PersistMarker = { version: number; rehydrated: boolean };

/** One restorer per persisted slice: `unknown` in, a valid slice (or its initial state) out. */
const RESTORERS: { readonly [K in PersistedKey]: (stored: unknown) => PersistedSlices[K] } = {
  searchHistory: (stored) => ({
    entries: restoreSearchHistory(isRecord(stored) ? stored.entries : undefined),
  }),
  // Line by line: a bad line is dropped, the rest stays; an unreadable slice is an empty cart.
  cart: (stored) => ({
    lines: restoreCartLines(isRecord(stored) ? stored.lines : undefined),
  }),
  checkoutAttempt: (stored) => {
    if (!isRecord(stored) || (stored.status !== 'preliminary' && stored.status !== 'unresolved') || !isText(stored.key) || !isText(stored.fingerprint)) return initialAttempt;
    return { key: stored.key, fingerprint: stored.fingerprint, status: 'unresolved', ...(stored.remoteStatus === 'pending' ? { remoteStatus: 'pending' as const } : {}) };
  },
  orderHistory: (stored) => {
    if (!isRecord(stored) || !Array.isArray(stored.orders)) return emptyOrderHistory;
    return sanitizeOrderHistory(stored);
  },
};

function isReadableVersion(version: unknown, currentVersion: number): boolean {
  if (version === currentVersion) return true;
  // The previous versions are only readable by the real schema, not by an injected one.
  return currentVersion === PERSIST_VERSION && typeof version === 'number' && READABLE_PREVIOUS_VERSIONS.includes(version);
}

function initialSlices(): PersistedSlices {
  return { searchHistory: { entries: EMPTY_SEARCH_HISTORY }, cart: { lines: EMPTY_CART }, checkoutAttempt: initialAttempt, orderHistory: emptyOrderHistory };
}

/**
 * Validates a stored state slice by slice.
 * - `undefined`/`null` (first launch, or a storage that could not be read): nothing to restore.
 * - Not an object, or without the current (or a readable previous) schema version: every slice gets
 *   its initial state.
 * - Otherwise each whitelisted slice goes through its restorer; any other key is dropped, even if
 *   an older build stored it.
 */
export function sanitizePersistedState(
  stored: unknown,
  currentVersion: number = PERSIST_VERSION,
): PersistedSlices | undefined {
  if (stored === undefined || stored === null) {
    return undefined;
  }

  if (
    !isRecord(stored) ||
    !isRecord(stored._persist) ||
    !isReadableVersion(stored._persist.version, currentVersion)
  ) {
    return initialSlices();
  }

  return {
    searchHistory: RESTORERS.searchHistory(stored.searchHistory),
    cart: RESTORERS.cart(stored.cart),
    checkoutAttempt: RESTORERS.checkoutAttempt(stored.checkoutAttempt),
    orderHistory: RESTORERS.orderHistory(stored.orderHistory),
  };
}

/**
 * The `migrate` hook of redux-persist: it runs between reading the disk and REHYDRATE. It never
 * rejects (a rejection is logged as a red error in development and is not needed: the sanitizer
 * already turns anything into a valid state).
 */
export function migratePersistedState(
  stored: unknown,
  currentVersion: number,
): Promise<(PersistedSlices & { _persist: PersistMarker }) | undefined> {
  let slices: PersistedSlices | undefined;
  try {
    slices = sanitizePersistedState(stored, currentVersion);
  } catch {
    slices = initialSlices();
  }

  return Promise.resolve(
    slices === undefined
      ? undefined
      : { ...slices, _persist: { version: currentVersion, rehydrated: false } },
  );
}

/** The single persist config of the root reducer. */
export function createPersistConfig<S>(storage: Storage): PersistConfig<S> {
  return {
    key: PERSIST_KEY,
    version: PERSIST_VERSION,
    storage,
    whitelist: [...PERSISTED_KEYS],
    migrate: migratePersistedState,
  };
}

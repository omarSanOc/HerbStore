/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { combineReducers, configureStore, type UnknownAction } from '@reduxjs/toolkit';
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

import { EMPTY_CART, type CartLine } from '../../features/cart/logic/cart.ts';
import { cartReducer, productAdded } from '../../features/cart/store/cart-slice.ts';
import { addSearch, EMPTY_SEARCH_HISTORY } from '../../features/search/logic/search-history.ts';
import { DEFAULT_PREFERENCES } from '../../features/preferences/logic/preferences.ts';
import { currencyChanged, languageChanged, preferencesReducer, themeChanged } from '../../features/preferences/store/preferences-slice.ts';
import {
  createPersistConfig,
  migratePersistedState,
  PERSIST_KEY,
  PERSIST_VERSION,
  PERSISTED_KEYS,
  sanitizePersistedState,
} from './persist-policy.ts';
import { createSafeStorage, type KeyValueBackend } from './persist-storage.ts';
import { initialAttempt } from '../../features/checkout/logic/attempt-machine.ts';

const STORAGE_KEY = `persist:${PERSIST_KEY}`;
const EMPTY_SLICES = {
  searchHistory: { entries: EMPTY_SEARCH_HISTORY },
  cart: { lines: EMPTY_CART },
  checkoutAttempt: initialAttempt,
  orderHistory: { orders: [], notifications: { records: {} } },
  preferences: DEFAULT_PREFERENCES,
};

function cartLine(overrides: Partial<CartLine> = {}): CartLine {
  return {
    productId: 'product-261009-001',
    quantity: 2,
    name: 'Complete Daily Powder',
    imagePath: '/images/products/product-001-front.png',
    unitPrice: 277.9,
    currency: 'MXN',
    stock: 10,
    ...overrides,
  };
}

/** What redux-persist itself writes: one JSON object whose values are JSON strings. */
function storedState(slices: Record<string, unknown>, version: unknown = PERSIST_VERSION): Record<string, unknown> {
  return { ...slices, _persist: { version, rehydrated: true } };
}

describe('PERSISTED_KEYS (explicit whitelist)', () => {
  it('contains the five explicitly persisted client slices', () => {
    assert.deepEqual(PERSISTED_KEYS, ['searchHistory', 'cart', 'checkoutAttempt', 'orderHistory', 'preferences']);
  });

  it('bumps the schema version when a persisted slice changes shape (v2: marks, v3: unusable reason, v4: preferences)', () => {
    assert.equal(PERSIST_VERSION, 4);
  });

  it('persists the preferences but never the RTK Query cache (api)', () => {
    const keys: readonly string[] = PERSISTED_KEYS;
    assert.equal(keys.includes('api'), false);
    assert.equal(keys.includes('preferences'), true);
  });

  it('is the whitelist of the redux-persist config, with the schema version', () => {
    const config = createPersistConfig(createSafeStorage(() => memoryBackend()));

    assert.deepEqual(config.whitelist, ['searchHistory', 'cart', 'checkoutAttempt', 'orderHistory', 'preferences']);
    assert.equal(config.version, PERSIST_VERSION);
    assert.equal(config.key, PERSIST_KEY);
    assert.equal(config.blacklist, undefined);
  });
});

describe('sanitizePersistedState', () => {
  it('nothing stored (first launch) gives nothing to restore', () => {
    assert.equal(sanitizePersistedState(undefined), undefined);
    assert.equal(sanitizePersistedState(null), undefined);
  });

  it('restores a valid history intact', () => {
    const stored = storedState({ searchHistory: { entries: ['zinc', 'Vitamina C'] } });

    assert.deepEqual(sanitizePersistedState(stored), { ...EMPTY_SLICES, searchHistory: { entries: ['zinc', 'Vitamina C'] } });
  });

  it('promotes a preliminary attempt and never carries address data', () => {
    const stored = storedState({ checkoutAttempt: { key: 'k', fingerprint: 'f', status: 'preliminary', shippingAddress: { fullName: 'Fictitious Person' } } });
    const sanitized = sanitizePersistedState(stored);
    assert.deepEqual(sanitized?.checkoutAttempt, { key: 'k', fingerprint: 'f', status: 'unresolved' });
    assert.equal(JSON.stringify(sanitized).includes('Fictitious Person'), false);
  });

  it('restores a valid cart intact', () => {
    const lines = [cartLine(), cartLine({ productId: 'product-261009-002', currency: 'USD', unitPrice: 9.99 })];
    const sanitized = sanitizePersistedState(storedState({ cart: { lines } }));

    assert.deepEqual(sanitized?.cart, { lines });
  });

  it('a state stored by the T1 build (no cart yet) restores an empty cart', () => {
    const sanitized = sanitizePersistedState(storedState({ searchHistory: { entries: ['zinc'] } }));
    assert.deepEqual(sanitized, { ...EMPTY_SLICES, searchHistory: { entries: ['zinc'] } });
  });

  it('drops every key outside the whitelist, even if an older build stored it', () => {
    const stored = storedState({
      searchHistory: { entries: ['zinc'] },
      api: { queries: { 'getProducts(undefined)': {} } },
      form: { fullName: 'Fictitious Person' },
      unknown: 1,
    });

    const sanitized = sanitizePersistedState(stored);
    assert.deepEqual(Object.keys(sanitized ?? {}), ['searchHistory', 'cart', 'checkoutAttempt', 'orderHistory', 'preferences']);
  });

  for (const [label, slice] of [
    ['missing', undefined],
    ['not an object', 'zinc'],
    ['without entries', {}],
    ['with corrupt entries', { entries: ['zinc', 3] }],
    ['with duplicated identities', { entries: ['Zinc', 'zinc'] }],
    ['with more than 10 entries', { entries: Array.from({ length: 11 }, (_, i) => `s${i}`) }],
  ] as const) {
    it(`a searchHistory slice ${label} falls back to its initial (empty) state`, () => {
      assert.deepEqual(sanitizePersistedState(storedState({ searchHistory: slice })), EMPTY_SLICES);
    });
  }

  for (const [label, slice] of [
    ['missing', undefined],
    ['not an object', 'cart'],
    ['without lines', {}],
    ['with lines that are not an array', { lines: { 0: cartLine() } }],
    ['with lines that are all invalid', { lines: [null, { productId: 'x' }, 3] }],
  ] as const) {
    it(`a cart slice ${label} falls back to the empty cart`, () => {
      assert.deepEqual(sanitizePersistedState(storedState({ cart: slice }))?.cart, { lines: EMPTY_CART });
    });
  }

  it('an invalid or duplicated cart line is dropped one by one; the valid ones stay', () => {
    const good = cartLine({ productId: 'product-261009-001' });
    const other = cartLine({ productId: 'product-261009-002', quantity: 1 });
    const stored = storedState({
      cart: {
        lines: [
          good,
          { ...cartLine({ productId: 'product-261009-003' }), name: undefined },
          cartLine({ productId: 'product-261009-004', quantity: 0 }),
          { ...good, quantity: 9 },
          other,
        ],
      },
    });

    assert.deepEqual(sanitizePersistedState(stored)?.cart, { lines: [good, other] });
  });

  it('a slice with the wrong shape never takes the other slice with it (the sanitizer judges slice by slice)', () => {
    const corruptCart = sanitizePersistedState(
      storedState({ searchHistory: { entries: ['zinc'] }, cart: 'corrupt' }),
    );
    assert.deepEqual(corruptCart?.searchHistory, { entries: ['zinc'] });
    assert.deepEqual(corruptCart?.cart, { lines: EMPTY_CART });

    const corruptHistory = sanitizePersistedState(
      storedState({ searchHistory: 'corrupt', cart: { lines: [cartLine()] } }),
    );
    assert.deepEqual(corruptHistory?.searchHistory, { entries: EMPTY_SEARCH_HISTORY });
    assert.deepEqual(corruptHistory?.cart, { lines: [cartLine()] });
  });

  it('the cart keeps only the snapshot fields: nothing else a stored line carried is restored', () => {
    const stored = storedState({ cart: { lines: [{ ...cartLine(), phone: '5555555555' }] } });
    assert.deepEqual(sanitizePersistedState(stored)?.cart, { lines: [cartLine()] });
  });

  for (const [label, stored] of [
    ['a string', 'corrupt'],
    ['an array', ['zinc']],
    ['a number', 7],
  ] as const) {
    it(`a whole stored state that is ${label} gives every slice its initial state`, () => {
      assert.deepEqual(sanitizePersistedState(stored), EMPTY_SLICES);
    });
  }

  it('an incompatible schema version gives every slice its initial state', () => {
    const stored = storedState({ searchHistory: { entries: ['zinc'] } }, PERSIST_VERSION + 1);
    assert.deepEqual(sanitizePersistedState(stored), EMPTY_SLICES);
  });

  it('a stored state without _persist is treated as incompatible', () => {
    assert.deepEqual(sanitizePersistedState({ searchHistory: { entries: ['zinc'] } }), EMPTY_SLICES);
  });
});

describe('migratePersistedState (the redux-persist migrate hook)', () => {
  it('resolves the sanitized slices with the current version', async () => {
    const migrated = await migratePersistedState(
      storedState({ searchHistory: { entries: ['zinc'] }, api: {} }),
      PERSIST_VERSION,
    );

    assert.deepEqual(migrated, { ...EMPTY_SLICES, searchHistory: { entries: ['zinc'] }, _persist: { version: PERSIST_VERSION, rehydrated: false } });
  });

  it('resolves undefined when nothing was stored', async () => {
    assert.equal(await migratePersistedState(undefined, PERSIST_VERSION), undefined);
  });

  it('never rejects, whatever was stored (a rejection would be a red screen in dev)', async () => {
    for (const stored of [42, 'x', [], { _persist: 'x' }, { searchHistory: null, _persist: null }]) {
      await assert.doesNotReject(migratePersistedState(stored, PERSIST_VERSION));
    }
  });
});

// ---------------------------------------------------------------------------------------------
// The real redux-persist pipeline (reducer, persistoid, rehydration) over an in-memory backend
// with the same shape as MMKV. It proves what ends up in storage, not only what the policy says.
// ---------------------------------------------------------------------------------------------

function memoryBackend(initial: Record<string, string> = {}): KeyValueBackend & {
  readonly values: Map<string, string>;
} {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getString: (key) => values.get(key),
    set: (key, value) => {
      values.set(key, value);
    },
    remove: (key) => values.delete(key),
  };
}

/** Stand-ins with the same keys as the app store (the real slices import React Native paths). */
function historyReducer(state = { entries: EMPTY_SEARCH_HISTORY }, action: UnknownAction) {
  if (action.type === 'searchHistory/searchSent' && typeof action.payload === 'string') {
    return { entries: addSearch(state.entries, action.payload) };
  }
  return state;
}

const rootReducer = combineReducers({
  api: (state: { queries: Record<string, unknown> } = { queries: { cached: { data: [1, 2, 3] } } }) =>
    state,
  preferences: preferencesReducer,
  searchHistory: historyReducer,
  cart: cartReducer,
});

async function startApp(backend: KeyValueBackend) {
  const store = configureStore({
    reducer: persistReducer(
      createPersistConfig<ReturnType<typeof rootReducer>>(createSafeStorage(() => backend)),
      rootReducer,
    ),
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: { ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER] },
      }),
  });
  const persistor = persistStore(store);

  await new Promise<void>((resolve) => {
    const check = () => {
      if (store.getState()._persist.rehydrated) {
        unsubscribe();
        resolve();
      }
    };
    const unsubscribe = store.subscribe(check);
    check();
  });

  return { store, persistor };
}

function readStorage(backend: { values: Map<string, string> }): Record<string, unknown> {
  const raw = backend.values.get(STORAGE_KEY);
  assert.ok(raw, 'something was written');
  return JSON.parse(raw) as Record<string, unknown>;
}

describe('redux-persist pipeline with the policy', () => {
  it('writes only the whitelisted slices (and _persist): never api', async () => {
    const backend = memoryBackend();
    const { store, persistor } = await startApp(backend);

    store.dispatch({ type: 'searchHistory/searchSent', payload: 'Vitamina C' });
    await persistor.flush();

    assert.deepEqual(Object.keys(readStorage(backend)).sort(), ['_persist', 'cart', 'preferences', 'searchHistory']);
    assert.equal(backend.values.get(STORAGE_KEY)?.includes('cached'), false);
    persistor.pause();
  });

  it('a restart restores the history with its order, deduplication and limit', async () => {
    const backend = memoryBackend();
    const first = await startApp(backend);
    for (const text of [...Array.from({ length: 11 }, (_, i) => `s${i + 1}`), 'Zinc', ' zinc ']) {
      first.store.dispatch({ type: 'searchHistory/searchSent', payload: text });
    }
    await first.persistor.flush();
    const before = first.store.getState().searchHistory.entries;
    first.persistor.pause();

    const second = await startApp(backend);

    assert.deepEqual(second.store.getState().searchHistory.entries, before);
    assert.equal(before.length, 10);
    assert.equal(before[0], 'zinc');
    second.persistor.pause();
  });

  for (const [label, raw] of [
    ['not JSON', '{not json'],
    ['JSON null', 'null'],
    ['a slice that is not JSON', JSON.stringify({ searchHistory: '{', _persist: '{"version":1}' })],
    [
      'a corrupt history',
      JSON.stringify({
        searchHistory: JSON.stringify({ entries: ['zinc', 'ZINC'] }),
        _persist: JSON.stringify({ version: PERSIST_VERSION, rehydrated: true }),
      }),
    ],
    [
      'another schema version',
      JSON.stringify({
        searchHistory: JSON.stringify({ entries: ['zinc'] }),
        _persist: JSON.stringify({ version: PERSIST_VERSION + 1, rehydrated: true }),
      }),
    ],
  ] as const) {
    it(`a stored state that is ${label} starts with an empty history and is overwritten`, async () => {
      const backend = memoryBackend({ [STORAGE_KEY]: raw });
      const { store, persistor } = await startApp(backend);

      assert.deepEqual(store.getState().searchHistory.entries, []);
      store.dispatch({ type: 'searchHistory/searchSent', payload: 'magnesio' });
      await persistor.flush();
      assert.deepEqual(readStorage(backend).searchHistory, JSON.stringify({ entries: ['magnesio'] }));
      persistor.pause();
    });
  }

  it('a restart restores the cart lines (snapshot, quantities and order)', async () => {
    const backend = memoryBackend();
    const first = await startApp(backend);
    first.store.dispatch(
      productAdded({
        product: { productId: 'product-261009-001', name: 'Zinc 25 mg', unitPrice: 11.99, currency: 'USD', stock: 9 },
        quantity: 3,
      }),
    );
    first.store.dispatch(
      productAdded({
        product: { productId: 'product-261009-002', name: 'Omega 3', imagePath: '/images/a.png', unitPrice: 300, currency: 'MXN', stock: 4 },
        quantity: 1,
      }),
    );
    await first.persistor.flush();
    const before = first.store.getState().cart;
    first.persistor.pause();

    const second = await startApp(backend);

    assert.deepEqual(second.store.getState().cart, before);
    assert.equal(before.lines.length, 2);
    second.persistor.pause();
  });

  it('a cart slice that is valid JSON of the wrong shape resets only the cart: the history survives', async () => {
    const raw = JSON.stringify({
      searchHistory: JSON.stringify({ entries: ['zinc', 'omega'] }),
      cart: JSON.stringify('corrupt'),
      _persist: JSON.stringify({ version: PERSIST_VERSION, rehydrated: true }),
    });
    const { store, persistor } = await startApp(memoryBackend({ [STORAGE_KEY]: raw }));

    assert.deepEqual(store.getState().cart.lines, []);
    assert.deepEqual(store.getState().searchHistory.entries, ['zinc', 'omega']);
    persistor.pause();
  });

  it('a cart slice that is NOT JSON cannot be read by redux-persist itself: the whole state starts empty', async () => {
    // Known limit of the library (it parses every slice before `migrate` runs): losing the history
    // too is the safe outcome, and the app never closes.
    const raw = JSON.stringify({
      searchHistory: JSON.stringify({ entries: ['zinc'] }),
      cart: 'corrupt',
      _persist: JSON.stringify({ version: PERSIST_VERSION, rehydrated: true }),
    });
    const { store, persistor } = await startApp(memoryBackend({ [STORAGE_KEY]: raw }));

    assert.deepEqual(store.getState().cart.lines, []);
    assert.deepEqual(store.getState().searchHistory.entries, []);
    persistor.pause();
  });

  it('a stored cart with one bad line restores the good lines and the history', async () => {
    const good = cartLine();
    const raw = JSON.stringify({
      searchHistory: JSON.stringify({ entries: ['zinc'] }),
      cart: JSON.stringify({ lines: [{ ...good, quantity: 0 }, good, null] }),
      _persist: JSON.stringify({ version: PERSIST_VERSION, rehydrated: true }),
    });
    const { store, persistor } = await startApp(memoryBackend({ [STORAGE_KEY]: raw }));

    assert.deepEqual(store.getState().cart.lines, [good]);
    assert.deepEqual(store.getState().searchHistory.entries, ['zinc']);
    persistor.pause();
  });

  for (const [label, raw] of [
    ['not JSON', '{not json'],
    ['a cart slice that is not JSON', JSON.stringify({ cart: '{', _persist: '{"version":1}' })],
    [
      'another schema version',
      JSON.stringify({
        cart: JSON.stringify({ lines: [cartLine()] }),
        _persist: JSON.stringify({ version: PERSIST_VERSION + 1, rehydrated: true }),
      }),
    ],
  ] as const) {
    it(`a stored state that is ${label} starts with an empty cart and is overwritten`, async () => {
      const backend = memoryBackend({ [STORAGE_KEY]: raw });
      const { store, persistor } = await startApp(backend);

      assert.deepEqual(store.getState().cart.lines, []);
      store.dispatch(
        productAdded({
          product: { productId: 'product-261009-001', name: 'Zinc', unitPrice: 10, currency: 'MXN', stock: 5 },
          quantity: 1,
        }),
      );
      await persistor.flush();
      assert.equal(JSON.parse(String(readStorage(backend).cart)).lines.length, 1);
      persistor.pause();
    });
  }

  it('the cart is saved as soon as it changes: no api, no form data next to it', async () => {
    const backend = memoryBackend();
    const { store, persistor } = await startApp(backend);

    store.dispatch(
      productAdded({
        product: { productId: 'product-261009-001', name: 'Zinc', unitPrice: 10, currency: 'MXN', stock: 5 },
        quantity: 2,
      }),
    );
    await persistor.flush();

    assert.deepEqual(Object.keys(readStorage(backend)).sort(), ['_persist', 'cart', 'preferences', 'searchHistory']);
    persistor.pause();
  });

  it('a backend that fails to read starts with an empty history without throwing', async () => {
    const backend: KeyValueBackend = {
      getString: () => {
        throw new Error('read failed');
      },
      set: () => undefined,
      remove: () => true,
    };
    const { store, persistor } = await startApp(backend);

    assert.deepEqual(store.getState().searchHistory.entries, []);
    persistor.pause();
  });
});

// ---------------------------------------------------------------------------------------------
// T8 raised PERSIST_VERSION to 2 (orderHistory gained `notifications`). The plan says the bump must
// KEEP cart, search, checkout attempt and orders: dropping the attempt would lose the idempotency
// key of an unresolved order (a duplicate order on recovery) and dropping the history loses orders.
// ---------------------------------------------------------------------------------------------
describe('upgrading from schema version 1 (the Day 4 build) to the current one', () => {
  const order = {
    id: 'order-1',
    items: [{ productId: 'product-261009-002', quantity: 1, unitPrice: 10, lineTotal: 10 }],
    currency: 'MXN',
    subtotal: 10,
    shipping: 0,
    total: 10,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
  const v1State = () =>
    storedState(
      {
        searchHistory: { entries: ['zinc'] },
        cart: { lines: [cartLine()] },
        checkoutAttempt: { key: 'k', fingerprint: 'f', status: 'preliminary' },
        orderHistory: { orders: [order] },
      },
      1,
    );

  it('keeps every slice and starts the orders with no notification marks', () => {
    assert.deepEqual(sanitizePersistedState(v1State()), {
      searchHistory: { entries: ['zinc'] },
      cart: { lines: [cartLine()] },
      checkoutAttempt: { key: 'k', fingerprint: 'f', status: 'unresolved' },
      orderHistory: { orders: [order], notifications: { records: {} } },
      preferences: DEFAULT_PREFERENCES,
    });
  });

  it('the migrate hook resolves them stamped with the CURRENT version', async () => {
    const migrated = await migratePersistedState(v1State(), PERSIST_VERSION);

    assert.deepEqual(migrated?._persist, { version: PERSIST_VERSION, rehydrated: false });
    assert.deepEqual(migrated?.cart, { lines: [cartLine()] });
    assert.deepEqual(migrated?.orderHistory.orders, [order]);
  });

  it('any other version still resets every slice (only the known previous ones are read)', () => {
    for (const version of [0, -1, 1.5, '2', PERSIST_VERSION + 1]) {
      assert.deepEqual(sanitizePersistedState(storedState({ cart: { lines: [cartLine()] } }, version)), EMPTY_SLICES, `version ${version}`);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// T13 raised PERSIST_VERSION to 3 (an `unusable` record gained `unusableReason`, RF-39). A v2 state
// (the Day 5 T8 build) must keep cart, search, attempt and orders; its unusable records had no
// reason and are restored as `blocked`, the conservative text that build was already showing.
// ---------------------------------------------------------------------------------------------
describe('upgrading from schema version 2 (the T8 build) to the current one', () => {
  const order = (id: string) => ({
    id,
    items: [{ productId: 'product-261009-002', quantity: 1, unitPrice: 10, lineTotal: 10 }],
    currency: 'MXN',
    subtotal: 10,
    shipping: 0,
    total: 10,
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  const v2State = () =>
    storedState(
      {
        searchHistory: { entries: ['zinc', 'Vitamina C'] },
        cart: { lines: [cartLine()] },
        checkoutAttempt: { key: 'k', fingerprint: 'f', status: 'unresolved', remoteStatus: 'pending' },
        orderHistory: {
          orders: [order('o-unusable'), order('o-scheduled'), order('o-failed')],
          notifications: {
            records: {
              'o-unusable': { permissionRequested: true, notified: false, status: 'unusable', canOpenSettings: true },
              'o-scheduled': { permissionRequested: true, notified: true, status: 'scheduled', canOpenSettings: false },
              'o-failed': { permissionRequested: true, notified: false, status: 'failed', canOpenSettings: false },
            },
          },
        },
      },
      2,
    );

  it('keeps every slice; a v2 unusable record (no reason) is blocked and the others carry no reason', () => {
    assert.deepEqual(sanitizePersistedState(v2State()), {
      searchHistory: { entries: ['zinc', 'Vitamina C'] },
      cart: { lines: [cartLine()] },
      checkoutAttempt: { key: 'k', fingerprint: 'f', status: 'unresolved', remoteStatus: 'pending' },
      orderHistory: {
        orders: [order('o-unusable'), order('o-scheduled'), order('o-failed')],
        notifications: {
          records: {
            'o-unusable': { permissionRequested: true, notified: false, status: 'unusable', canOpenSettings: true, unusableReason: 'blocked' },
            'o-scheduled': { permissionRequested: true, notified: true, status: 'scheduled', canOpenSettings: false },
            'o-failed': { permissionRequested: true, notified: false, status: 'failed', canOpenSettings: false },
          },
        },
      },
      preferences: DEFAULT_PREFERENCES,
    });
  });

  it('the migrate hook resolves a v2 state stamped with the current version', async () => {
    const migrated = await migratePersistedState(v2State(), PERSIST_VERSION);

    assert.deepEqual(migrated?._persist, { version: PERSIST_VERSION, rehydrated: false });
    assert.deepEqual(migrated?.cart, { lines: [cartLine()] });
    assert.deepEqual(migrated?.searchHistory, { entries: ['zinc', 'Vitamina C'] });
    assert.equal(migrated?.orderHistory.orders.length, 3);
  });

  it('a v1 state is still readable by the current version', async () => {
    const v1 = storedState({ cart: { lines: [cartLine()] }, orderHistory: { orders: [order('o1')] } }, 1);
    const migrated = await migratePersistedState(v1, PERSIST_VERSION);

    assert.deepEqual(migrated?._persist, { version: PERSIST_VERSION, rehydrated: false });
    assert.deepEqual(migrated?.cart, { lines: [cartLine()] });
    assert.deepEqual(migrated?.orderHistory, { orders: [order('o1')], notifications: { records: {} } });
  });

  it('a v3 state keeps a valid reason as stored', () => {
    const v3 = storedState({
      orderHistory: {
        orders: [order('o1')],
        notifications: { records: { o1: { permissionRequested: true, notified: false, status: 'unusable', canOpenSettings: true, unusableReason: 'denied-recoverable' } } },
      },
    }, 3);

    assert.equal(sanitizePersistedState(v3)?.orderHistory.notifications.records.o1?.unusableReason, 'denied-recoverable');
  });

  it('an injected schema version never reads the real previous versions', () => {
    assert.deepEqual(sanitizePersistedState(v2State(), 9), EMPTY_SLICES);
  });
});

// ---------------------------------------------------------------------------------------------
// Day 6 T4a raised PERSIST_VERSION to 4: `preferences` (language, currency, theme) joined the
// whitelist. No older build ever wrote it, so v1-v3 states carry no `preferences` key: the upgrade
// must keep cart, history, checkout attempt (the idempotency key of an unresolved order) and
// orders untouched, and start the preferences from their defaults.
// ---------------------------------------------------------------------------------------------
describe('upgrading from schema versions 1-3 to version 4 (preferences join the whitelist)', () => {
  const order = {
    id: 'order-1',
    items: [{ productId: 'product-261009-002', quantity: 1, unitPrice: 10, lineTotal: 10 }],
    currency: 'MXN',
    subtotal: 10,
    shipping: 0,
    total: 10,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
  const keptSlices = () => ({
    searchHistory: { entries: ['zinc', 'Vitamina C'] },
    cart: { lines: [cartLine()] },
    checkoutAttempt: { key: 'k', fingerprint: 'f', status: 'unresolved', remoteStatus: 'pending' },
    orderHistory: { orders: [order], notifications: { records: {} } },
  });

  for (const version of [1, 2, 3]) {
    it(`a v${version} state keeps the cart, the history, the attempt and the orders and starts the preferences from their defaults`, async () => {
      const migrated = await migratePersistedState(storedState(keptSlices(), version), PERSIST_VERSION);

      assert.deepEqual(migrated, { ...keptSlices(), preferences: DEFAULT_PREFERENCES, _persist: { version: 4, rehydrated: false } });
    });
  }

  it('a v3 state whose preferences key was somehow written still goes through the restorer, field by field', () => {
    const sanitized = sanitizePersistedState(storedState({ ...keptSlices(), preferences: { language: 'fr', currency: 'USD', theme: 'dark', extra: 1 } }, 3));

    assert.deepEqual(sanitized?.preferences, { currency: 'USD', theme: 'dark' });
    assert.deepEqual(sanitized?.cart, { lines: [cartLine()] });
  });

  it('a v4 state restores the stored preferences', () => {
    const preferences = { language: 'en', currency: 'USD', theme: 'dark' };

    assert.deepEqual(sanitizePersistedState(storedState({ preferences }))?.preferences, preferences);
  });

  for (const [label, preferences] of [
    ['missing', undefined],
    ['null', null],
    ['not an object', 'dark'],
    ['an array', ['en', 'USD', 'dark']],
  ] as const) {
    it(`a preferences slice that is ${label} falls back to the defaults and takes no other slice with it`, () => {
      const sanitized = sanitizePersistedState(storedState({ ...keptSlices(), preferences }));

      assert.deepEqual(sanitized?.preferences, DEFAULT_PREFERENCES);
      assert.deepEqual(sanitized?.cart, { lines: [cartLine()] });
      assert.deepEqual(sanitized?.searchHistory, { entries: ['zinc', 'Vitamina C'] });
    });
  }

  it('an invalid field falls back alone', () => {
    const sanitized = sanitizePersistedState(storedState({ preferences: { language: 'en', currency: 'EUR', theme: 'sepia' } }));

    assert.deepEqual(sanitized?.preferences, { language: 'en', currency: 'MXN', theme: 'system' });
  });

  it('an unknown version still resets everything, preferences included', () => {
    const stored = storedState({ ...keptSlices(), preferences: { language: 'en', currency: 'USD', theme: 'dark' } }, PERSIST_VERSION + 1);

    assert.deepEqual(sanitizePersistedState(stored), EMPTY_SLICES);
  });

  it('an injected schema version never reads the real previous versions', () => {
    assert.deepEqual(sanitizePersistedState(storedState(keptSlices(), 3), 9), EMPTY_SLICES);
  });

  it('never carries personal data next to the preferences', () => {
    const stored = storedState({ preferences: { language: 'en', currency: 'USD', theme: 'dark', email: 'person@example.test', fullName: 'Fictitious Person' } });

    assert.equal(JSON.stringify(sanitizePersistedState(stored)).includes('Fictitious'), false);
    assert.equal(JSON.stringify(sanitizePersistedState(stored)).includes('person@example.test'), false);
  });
});

describe('preferences through the real redux-persist pipeline', () => {
  it('a restart restores the language, currency and theme the user chose', async () => {
    const backend = memoryBackend();
    const first = await startApp(backend);
    first.store.dispatch(languageChanged('en'));
    first.store.dispatch(currencyChanged('USD'));
    first.store.dispatch(themeChanged('dark'));
    await first.persistor.flush();
    first.persistor.pause();

    const second = await startApp(backend);

    assert.deepEqual(second.store.getState().preferences, { language: 'en', currency: 'USD', theme: 'dark' });
    second.persistor.pause();
  });

  it('a language that was never chosen is never written: the stored slice has no language key', async () => {
    const backend = memoryBackend();
    const { store, persistor } = await startApp(backend);
    store.dispatch(currencyChanged('USD'));
    await persistor.flush();

    const stored = JSON.parse(String(readStorage(backend).preferences)) as Record<string, unknown>;
    assert.deepEqual(stored, { currency: 'USD', theme: 'system' });
    assert.equal('language' in stored, false);
    persistor.pause();
  });

  it('a v3 state on disk is upgraded in place: the cart survives and the next write is stamped v4', async () => {
    const raw = JSON.stringify({
      searchHistory: JSON.stringify({ entries: ['zinc'] }),
      cart: JSON.stringify({ lines: [cartLine()] }),
      _persist: JSON.stringify({ version: 3, rehydrated: true }),
    });
    const backend = memoryBackend({ [STORAGE_KEY]: raw });
    const { store, persistor } = await startApp(backend);

    assert.deepEqual(store.getState().cart.lines, [cartLine()]);
    assert.deepEqual(store.getState().searchHistory.entries, ['zinc']);
    assert.deepEqual(store.getState().preferences, DEFAULT_PREFERENCES);

    store.dispatch(themeChanged('light'));
    await persistor.flush();
    assert.deepEqual(JSON.parse(String(readStorage(backend)._persist)), { version: 4, rehydrated: true });
    assert.deepEqual(JSON.parse(String(readStorage(backend).preferences)), { currency: 'MXN', theme: 'light' });
    persistor.pause();
  });

  it('a stored preferences slice with invalid fields restores the valid ones', async () => {
    const raw = JSON.stringify({
      preferences: JSON.stringify({ language: 'fr', currency: 'USD', theme: 'dark' }),
      _persist: JSON.stringify({ version: PERSIST_VERSION, rehydrated: true }),
    });
    const { store, persistor } = await startApp(memoryBackend({ [STORAGE_KEY]: raw }));

    assert.deepEqual(store.getState().preferences, { currency: 'USD', theme: 'dark' });
    persistor.pause();
  });
});

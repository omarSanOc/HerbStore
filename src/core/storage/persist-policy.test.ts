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
  orderHistory: { orders: [] },
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
function storedState(slices: Record<string, unknown>, version = PERSIST_VERSION): Record<string, unknown> {
  return { ...slices, _persist: { version, rehydrated: true } };
}

describe('PERSISTED_KEYS (explicit whitelist)', () => {
  it('contains the four explicitly persisted client slices', () => {
    assert.deepEqual(PERSISTED_KEYS, ['searchHistory', 'cart', 'checkoutAttempt', 'orderHistory']);
  });

  it('keeps the schema version at 1 (adding a slice to the whitelist is not a shape change)', () => {
    assert.equal(PERSIST_VERSION, 1);
  });

  it('never contains the RTK Query cache (api) nor the in-memory preferences', () => {
    const keys: readonly string[] = PERSISTED_KEYS;
    assert.equal(keys.includes('api'), false);
    assert.equal(keys.includes('preferences'), false);
  });

  it('is the whitelist of the redux-persist config, with the schema version', () => {
    const config = createPersistConfig(createSafeStorage(() => memoryBackend()));

    assert.deepEqual(config.whitelist, ['searchHistory', 'cart', 'checkoutAttempt', 'orderHistory']);
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
      preferences: { currency: 'USD' },
      unknown: 1,
    });

    const sanitized = sanitizePersistedState(stored);
    assert.deepEqual(Object.keys(sanitized ?? {}), ['searchHistory', 'cart', 'checkoutAttempt', 'orderHistory']);
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
  preferences: (state: { currency: 'MXN' | 'USD' } = { currency: 'USD' }) => state,
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
  it('writes only the whitelisted slices (and _persist): never api nor preferences', async () => {
    const backend = memoryBackend();
    const { store, persistor } = await startApp(backend);

    store.dispatch({ type: 'searchHistory/searchSent', payload: 'Vitamina C' });
    await persistor.flush();

    assert.deepEqual(Object.keys(readStorage(backend)).sort(), ['_persist', 'cart', 'searchHistory']);
    assert.equal(backend.values.get(STORAGE_KEY)?.includes('cached'), false);
    assert.equal(backend.values.get(STORAGE_KEY)?.includes('USD'), false);
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

  it('the cart is saved as soon as it changes: no preferences, no api, no form data next to it', async () => {
    const backend = memoryBackend();
    const { store, persistor } = await startApp(backend);

    store.dispatch(
      productAdded({
        product: { productId: 'product-261009-001', name: 'Zinc', unitPrice: 10, currency: 'MXN', stock: 5 },
        quantity: 2,
      }),
    );
    await persistor.flush();

    assert.deepEqual(Object.keys(readStorage(backend)).sort(), ['_persist', 'cart', 'searchHistory']);
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

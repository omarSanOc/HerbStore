/// <reference types="jest" />
// RF-3, RF-17 (T2). The cart on the REAL persisted store: it is locked until redux-persist has
// restored it (a change made before would be overwritten by the restore), it is restored line by
// line, and what it writes is only what the whitelist allows. The pure rules are in
// `cart.test.ts` / `cart-selectors.test.ts` (node:test); this file proves the wiring.
//
// `.tsx` with no JSX: the extension only picks the runner (Jest), because it needs the store.
//
// Compose: a `DataStore`-backed repository test with a gated `ReadChannel`. SwiftUI: an
// `@Observable` model whose `load()` has not returned yet.
import { PERSIST_KEY, PERSIST_VERSION } from '@/core/storage/persist-policy';
import { selectCanCheckout, selectIsCartLocked, selectSubtotalMxnCents } from '@/features/cart/logic/cart-selectors';

import { createMemoryStorage, createTestStore, startPersistence } from '@/test/fixtures';
import { createMockFetch, reply } from '@/test/mock-fetch';

import { addProductToCart } from './add-to-cart';
import { productAdded } from './cart-slice';

const STORED_LINE = {
  productId: 'product-261009-001',
  name: 'Complete Daily Powder 001',
  unitPrice: 100,
  currency: 'MXN',
  stock: 5,
  quantity: 2,
};

const NEW_PRODUCT = { productId: 'product-261009-002', name: 'Complete Daily Powder 002', unitPrice: 10, currency: 'USD' as const, stock: 3 };

const persisted = (cart: unknown, extra: Record<string, unknown> = {}) => ({
  [`persist:${PERSIST_KEY}`]: JSON.stringify({
    cart: JSON.stringify(cart),
    ...Object.fromEntries(Object.entries(extra).map(([key, value]) => [key, JSON.stringify(value)])),
    _persist: JSON.stringify({ version: PERSIST_VERSION, rehydrated: true }),
  }),
});

describe('cart on the persisted store', () => {
  // Restoring an open checkout attempt asks the server for its status (REHYDRATE listener). The
  // controlled fetch answers it and, in `afterEach`, proves that nothing else tried to reach a network.
  let mock: ReturnType<typeof createMockFetch>;

  beforeEach(() => {
    mock = createMockFetch();
    mock.always('GET /orders/status/key-1', reply.success({ status: 'pending', retryAfterSeconds: 1 }, { status: 202 }));
    mock.install();
  });

  afterEach(() => {
    mock.uninstall();
    expect(mock.unmatched).toEqual([]);
  });

  describe('locked until rehydrated (RF-11 of spec 004)', () => {
    it('refuses changes while the storage has not answered, then restores and unlocks', async () => {
      const storage = createMemoryStorage({ initial: persisted({ lines: [STORED_LINE] }), holdReads: true });
      const store = createTestStore({ storage });
      const { rehydrated } = startPersistence(store);

      // The disk has not answered: the cart is empty in memory but the app must not trust that.
      expect(selectIsCartLocked(store.getState())).toBe(true);
      expect(selectCanCheckout(store.getState())).toBe(false);
      expect(store.getState().cart.lines).toEqual([]);

      const blocked = store.dispatch(addProductToCart({ product: NEW_PRODUCT, quantity: 1 }));
      expect(blocked).toEqual({ status: 'locked' });
      expect(store.getState().cart.lines).toEqual([]);

      storage.releaseReads();
      await rehydrated;

      // Nothing the user did while locked was lost or merged wrongly: the stored cart is intact.
      expect(selectIsCartLocked(store.getState())).toBe(false);
      expect(store.getState().cart.lines).toEqual([STORED_LINE]);
      expect(selectCanCheckout(store.getState())).toBe(true);

      const added = store.dispatch(addProductToCart({ product: NEW_PRODUCT, quantity: 1 }));
      expect(added).toMatchObject({ status: 'added', quantityInCart: 1 });
      expect(store.getState().cart.lines.map(({ productId }) => productId)).toEqual([STORED_LINE.productId, NEW_PRODUCT.productId]);
    });

    it('a cart restored with lines still cannot check out while the restore is pending', async () => {
      const storage = createMemoryStorage({ holdReads: true });
      const store = createTestStore({
        storage,
        preloadedState: { cart: { lines: [STORED_LINE] } } as never,
      });
      const { rehydrated } = startPersistence(store);

      expect(store.getState().cart.lines).toHaveLength(1);
      expect(selectCanCheckout(store.getState())).toBe(false);

      storage.releaseReads();
      await rehydrated;
      expect(selectCanCheckout(store.getState())).toBe(true);
    });

    it('an empty disk (first launch) unlocks an empty cart', async () => {
      const store = createTestStore();
      await startPersistence(store).rehydrated;

      expect(selectIsCartLocked(store.getState())).toBe(false);
      expect(store.getState().cart.lines).toEqual([]);
      expect(selectCanCheckout(store.getState())).toBe(false);
    });

    it('is locked as well while a checkout attempt is open, even when rehydrated', async () => {
      jest.useFakeTimers();
      const store = createTestStore({
        storage: createMemoryStorage({
          initial: persisted({ lines: [STORED_LINE] }, { checkoutAttempt: { status: 'unresolved', key: 'key-1', fingerprint: 'fp' } }),
        }),
      });
      await startPersistence(store).rehydrated;
      await jest.advanceTimersByTimeAsync(10); // lets the restored attempt's status query settle

      expect(mock.calls.map(({ method, path }) => `${method} ${path}`)).toEqual(['GET /orders/status/key-1']);
      expect(store.getState().checkoutAttempt.status).toBe('unresolved');
      expect(selectIsCartLocked(store.getState())).toBe(true);
      expect(store.dispatch(addProductToCart({ product: NEW_PRODUCT, quantity: 1 }))).toEqual({ status: 'locked' });
      expect(store.getState().cart.lines).toEqual([STORED_LINE]);
    });
  });

  describe('restored line by line', () => {
    it('drops only the invalid and duplicated lines and keeps the valid ones in order', async () => {
      const lines = [
        STORED_LINE,
        { ...STORED_LINE, productId: 'product-261009-002', quantity: 9 }, // above its stock
        { ...STORED_LINE, productId: 'product-261009-003', unitPrice: -1 }, // negative price
        { ...STORED_LINE, productId: 'product-261009-004', currency: 'EUR' }, // unsupported currency
        { ...STORED_LINE, productId: 'product-261009-005', quantity: 0 }, // nothing to buy
        { ...STORED_LINE, quantity: 1 }, // second line for the first product: the first wins
        { ...STORED_LINE, productId: 'product-261009-006', quantity: 1, stock: 1, unitPrice: 20, currency: 'USD', extra: 'dropped' },
        'not even an object',
      ];
      const store = createTestStore({ storage: createMemoryStorage({ initial: persisted({ lines }) }) });

      await startPersistence(store).rehydrated;

      expect(store.getState().cart.lines).toEqual([
        STORED_LINE,
        { productId: 'product-261009-006', name: STORED_LINE.name, unitPrice: 20, currency: 'USD', stock: 1, quantity: 1 },
      ]);
      expect(selectSubtotalMxnCents(store.getState())).toBe(2 * 10_000 + 2_000 * 18);
    });

    it.each([
      ['a slice that is not an object', 'broken'],
      ['a slice without lines', {}],
      ['lines that are not an array', { lines: { 0: STORED_LINE } }],
      ['null', null],
    ])('%s starts with an empty cart and unlocks', async (_label, stored) => {
      const store = createTestStore({ storage: createMemoryStorage({ initial: persisted(stored) }) });

      await startPersistence(store).rehydrated;

      expect(store.getState().cart.lines).toEqual([]);
      expect(selectIsCartLocked(store.getState())).toBe(false);
    });

    it('a state saved by another schema version is ignored, not half-read', async () => {
      const initial = {
        [`persist:${PERSIST_KEY}`]: JSON.stringify({
          cart: JSON.stringify({ lines: [STORED_LINE] }),
          _persist: JSON.stringify({ version: 99, rehydrated: true }),
        }),
      };
      const store = createTestStore({ storage: createMemoryStorage({ initial }) });

      await startPersistence(store).rehydrated;

      expect(store.getState().cart.lines).toEqual([]);
    });
  });

  describe('what reaches the disk', () => {
    it('writes the cart after a change and never the API cache', async () => {
      const storage = createMemoryStorage();
      const store = createTestStore({ storage });
      const { persistor, rehydrated } = startPersistence(store);
      await rehydrated;

      store.dispatch(productAdded({ product: NEW_PRODUCT, quantity: 2 }));
      await persistor.flush();

      const written = JSON.parse(storage.data.get(`persist:${PERSIST_KEY}`) ?? '{}') as Record<string, string>;
      expect(JSON.parse(written.cart ?? '{}')).toEqual({
        lines: [{ ...NEW_PRODUCT, quantity: 2 }],
      });
      expect(Object.keys(written)).not.toContain('api');
    });

    it('a restart restores what was written (round trip through the real storage engine)', async () => {
      const storage = createMemoryStorage();
      const first = createTestStore({ storage });
      const firstPersistence = startPersistence(first);
      await firstPersistence.rehydrated;
      first.dispatch(productAdded({ product: NEW_PRODUCT, quantity: 3 }));
      await firstPersistence.persistor.flush();

      const second = createTestStore({ storage });
      await startPersistence(second).rehydrated;

      expect(second.getState().cart.lines).toEqual([{ ...NEW_PRODUCT, quantity: 3 }]);
    });
  });
});

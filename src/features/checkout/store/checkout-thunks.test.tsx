/// <reference types="jest" />
// RF-17, RF-5 (T2). The idempotent order protocol on the REAL stack: store + thunks + RTK Query +
// `fetchJson` + contract parsers, over a controlled `fetch`. The pure transition table lives in
// `attempt-machine.test.ts` (node:test); this file proves the pieces are wired so that an order
// that was not confirmed by the server is never shown or recorded as confirmed.
//
// `.tsx` with no JSX: the extension only picks the runner (Jest), because it needs RTK Query,
// the store and `mock-fetch`.
//
// Compose/Android: a ViewModel test with a `MockWebServer` and `runTest`. Swift: a `URLProtocol`
// stub plus an `XCTestExpectation` per request.
import { PERSIST_KEY, PERSIST_VERSION } from '@/core/storage/persist-policy';
import { cartCleared, productAdded } from '@/features/cart/store/cart-slice';

import { createMemoryStorage, createTestStore, startPersistence, wireProduct } from '@/test/fixtures';
import { createMockFetch, reply } from '@/test/mock-fetch';

import { checkOrderStatus, submitOrder } from './checkout-thunks';

// Predictable keys (`key-0001`, `key-0002`, ...: one per attempt, like the real UUIDs are distinct)
// and a trivial digest. The protocol under test is the same, and the assertions can name the key.
// (`expo-crypto` is a native module; the real digest is checked on devices.) The `mock` prefix lets
// the hoisted `jest.mock` factory read the counter.
const KEY = 'key-0001';
let mockKeyCounter = 0;
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  randomUUID: jest.fn(() => `key-${String(++mockKeyCounter).padStart(4, '0')}`),
  digestStringAsync: jest.fn(async (_algorithm: string, value: string) => `digest-${value.length}`),
}));

const ADDRESS = {
  fullName: 'Ana Perez',
  phone: '5512345678',
  postalCode: '01234',
  state: 'Jalisco',
  city: 'Guadalajara',
  street: 'Avenida Central',
  exteriorNumber: '10',
};

const PRODUCT = {
  productId: 'product-261009-001',
  name: 'Complete Daily Powder 001',
  unitPrice: 100,
  currency: 'MXN' as const,
  stock: 5,
};

const SUMMARY = {
  id: 'order-0001',
  items: [{ productId: PRODUCT.productId, quantity: 2, unitPrice: 100, lineTotal: 200 }],
  currency: 'MXN',
  subtotal: 200,
  shipping: 99,
  total: 299,
  createdAt: '2026-10-15T10:00:00.000Z',
};

const CONFIRMED = reply.success({ status: 'confirmed', order: SUMMARY });
const PENDING = reply.success({ status: 'pending', retryAfterSeconds: 1, key: KEY }, { status: 202 });
const statusPath = (key = KEY) => `/orders/status/${key}`;

/** The error bodies the server sends, as `parseOrderError` expects them. */
const errorBody = {
  validation: reply.clientError(400, { error: { code: 'VALIDATION_ERROR' }, fields: { phone: 'invalid' } }),
  outOfStock: reply.clientError(409, { error: { code: 'OUT_OF_STOCK' } }),
  keyReused: reply.clientError(409, { error: { code: 'IDEMPOTENCY_KEY_REUSED' }, links: { status: statusPath() } }),
  notCreated: reply.clientError(404, { error: { code: 'ORDER_NOT_CREATED' }, status: 'not_created' }),
  expired: reply.clientError(410, { error: { code: 'IDEMPOTENCY_KEY_EXPIRED' }, status: 'expired' }),
};

describe('idempotent checkout on the real stack', () => {
  let mock: ReturnType<typeof createMockFetch>;
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    mockKeyCounter = 0;
    jest.useFakeTimers();
    mock = createMockFetch();
    mock.install();
    store = createTestStore();
    store.dispatch(productAdded({ product: PRODUCT, quantity: 2 }));
  });

  afterEach(() => {
    mock.uninstall();
  });

  const submit = async () => {
    const pending = store.dispatch(submitOrder({ shippingAddress: ADDRESS }));
    // Let a possible 8 s timeout fire; a request that answered earlier is unaffected.
    await jest.advanceTimersByTimeAsync(8_000);
    return pending.unwrap();
  };

  const check = async () => {
    const pending = store.dispatch(checkOrderStatus(KEY));
    await jest.advanceTimersByTimeAsync(8_000);
    return pending.unwrap();
  };

  const posts = () => mock.calls.filter(({ method }) => method === 'POST');

  /** The invariant of the protocol: nothing that is not a confirmed 200 clears the cart or lands in the history. */
  const expectNotConfirmed = () => {
    expect(store.getState().cart.lines).toHaveLength(1);
    expect(store.getState().orderHistory.orders).toHaveLength(0);
  };

  describe('POST /orders', () => {
    it('200 confirmed: the cart is cleared, the order is recorded and the attempt ends', async () => {
      mock.enqueue('POST /orders', CONFIRMED);

      const result = await submit();

      expect(result.outcome).toBe('confirmed');
      expect(store.getState().cart.lines).toEqual([]);
      expect(store.getState().orderHistory.orders.map(({ id }) => id)).toEqual(['order-0001']);
      expect(store.getState().checkoutAttempt).toEqual({ status: 'idle' });
      expect(posts()).toHaveLength(1);
    });

    it('sends the stable Idempotency-Key and the canonical request', async () => {
      mock.enqueue('POST /orders', CONFIRMED);

      await submit();

      expect(posts()[0]?.headers['idempotency-key']).toBe(KEY);
      expect(posts()[0]?.body).toEqual({
        items: [{ productId: PRODUCT.productId, quantity: 2 }],
        currency: 'MXN',
        shippingAddress: ADDRESS,
      });
    });

    it('202 pending: the order is NOT confirmed, the attempt stays open with its key', async () => {
      mock.enqueue('POST /orders', PENDING);

      const result = await submit();

      expect(result.outcome).toBe('pending');
      expect(store.getState().checkoutAttempt).toMatchObject({ status: 'unresolved', key: KEY, remoteStatus: 'pending' });
      expectNotConfirmed();
    });

    it('409 key reused: another attempt owns the key, ask for its status; not confirmed', async () => {
      mock.enqueue('POST /orders', errorBody.keyReused);

      const result = await submit();

      expect(result.outcome).toBe('keyReused');
      expect(store.getState().checkoutAttempt).toMatchObject({ status: 'unresolved', key: KEY });
      expectNotConfirmed();
    });

    it('409 out of stock: nothing was created, the attempt ends (key freed) and the order is not recorded', async () => {
      mock.enqueue('POST /orders', errorBody.outOfStock);

      const result = await submit();

      expect(result.outcome).toBe('outOfStock');
      expect(store.getState().checkoutAttempt).toEqual({ status: 'idle' });
      expectNotConfirmed();
    });

    // Defect found by T2 and fixed in T3b (spec 004 RF-26): `outOfStock` is an HTTP 409, so
    // `unwrap()` throws and the stock refresh that used to live after it never ran. The refresh now
    // runs for the outcome, whichever branch produced it.
    it('409 out of stock: refreshes the stock and clamps the cart line (RF-26)', async () => {
      mock.enqueue('POST /orders', errorBody.outOfStock);
      mock.enqueue(`GET /products/${PRODUCT.productId}`, reply.success(wireProduct(1, { stock: 1 })));

      const result = await submit();

      expect(mock.calls.map(({ method, path }) => `${method} ${path}`)).toContain(`GET /products/${PRODUCT.productId}`);
      expect(store.getState().cart.lines).toMatchObject([{ productId: PRODUCT.productId, quantity: 1, stock: 1 }]);
      expect(result).toMatchObject({ adjustments: [{ productId: PRODUCT.productId, previousQuantity: 2, quantity: 1 }] });
    });

    it('409 out of stock for a product that sold out: the line is removed and reported as removed', async () => {
      mock.enqueue('POST /orders', errorBody.outOfStock);
      mock.enqueue(`GET /products/${PRODUCT.productId}`, reply.success(wireProduct(1, { stock: 0, inStock: false })));

      const result = await submit();

      expect(store.getState().cart.lines).toEqual([]);
      expect(result).toMatchObject({ outcome: 'outOfStock', adjustments: [{ productId: PRODUCT.productId, previousQuantity: 2, quantity: 0, removed: true }] });
      expect(store.getState().checkoutAttempt).toEqual({ status: 'idle' });
    });

    it('409 out of stock while the catalog is unreachable: the cart is kept, nothing is reported, the attempt still ends', async () => {
      mock.enqueue('POST /orders', errorBody.outOfStock);
      mock.always(`GET /products/${PRODUCT.productId}`, reply.networkError());

      const result = await submit();

      expect(result).toMatchObject({ outcome: 'outOfStock', adjustments: [] });
      expect(store.getState().cart.lines).toMatchObject([{ quantity: 2, stock: 5 }]);
      expect(store.getState().checkoutAttempt).toEqual({ status: 'idle' });
    });

    it('400 validation: the attempt ends and the cart is untouched', async () => {
      mock.enqueue('POST /orders', errorBody.validation);

      const result = await submit();

      expect(result.outcome).toBe('validation');
      expect(store.getState().checkoutAttempt).toEqual({ status: 'idle' });
      expectNotConfirmed();
    });

    it('400 validation hands the server paths (never their values) to the screen', async () => {
      mock.enqueue('POST /orders', reply.clientError(400, { error: { code: 'VALIDATION_ERROR' }, fields: { 'shippingAddress.phone': 'INVALID_FORMAT', 'items[0].quantity': 'OUT_OF_RANGE' } }));

      const result = await submit();

      expect(result).toMatchObject({ outcome: 'validation', fields: { 'shippingAddress.phone': 'INVALID_FORMAT', 'items[0].quantity': 'OUT_OF_RANGE' } });
    });

    // `uncertain`: the app has no readable answer. `inconsistent`: it got a status but the body does
    // not honour the order-error contract. Both leave the attempt unresolved, and neither confirms.
    it.each([
      { label: 'timeout (no answer in 8 s)', failure: reply.timeout(), outcome: 'uncertain' },
      { label: 'offline (fetch rejects)', failure: reply.networkError(), outcome: 'uncertain' },
      { label: '200 with a body that breaks the contract', failure: reply.success({ status: 'confirmed' }), outcome: 'uncertain' },
      { label: '503 (a gateway body that is not the order error)', failure: reply.serverError(503), outcome: 'inconsistent' },
      { label: 'a 4xx the contract does not know', failure: reply.clientError(418, { error: { code: 'TEAPOT' } }), outcome: 'inconsistent' },
    ])('$label -> $outcome: attempt unresolved, ONE request (no blind replay), never confirmed', async ({ failure, outcome }) => {
      mock.enqueue('POST /orders', failure);

      const result = await submit();

      expect(result.outcome).toBe(outcome);
      expect(store.getState().checkoutAttempt).toMatchObject({ status: 'unresolved', key: KEY });
      expect(posts()).toHaveLength(1);
      expectNotConfirmed();
    });

    it('a double tap sends ONE POST: the second submit sees the attempt already open', async () => {
      mock.enqueue('POST /orders', CONFIRMED);

      const first = store.dispatch(submitOrder({ shippingAddress: ADDRESS }));
      const second = store.dispatch(submitOrder({ shippingAddress: ADDRESS }));
      await jest.advanceTimersByTimeAsync(0);
      const [one, two] = [await first.unwrap(), await second.unwrap()];

      expect(posts()).toHaveLength(1);
      expect([one.outcome, two.outcome].sort()).toEqual(['confirmed', 'uncertain']);
      expect('ignored' in two || 'ignored' in one).toBe(true);
      expect(store.getState().orderHistory.orders).toHaveLength(1);
    });

    it('does nothing for an empty cart', async () => {
      store.dispatch(cartCleared());

      const result = await submit();

      expect(result).toMatchObject({ outcome: 'uncertain', ignored: true });
      expect(mock.calls).toHaveLength(0);
      expect(store.getState().checkoutAttempt).toEqual({ status: 'idle' });
    });
  });

  describe('GET /orders/status/:key after an uncertain answer', () => {
    /** Leaves the attempt `unresolved` the way a lost answer does. */
    const loseTheAnswer = async () => {
      mock.enqueue('POST /orders', reply.timeout());
      await submit();
      expect(store.getState().checkoutAttempt).toMatchObject({ status: 'unresolved', key: KEY });
    };

    it('uses the SAME key as the POST and confirms only on a valid 200', async () => {
      await loseTheAnswer();
      mock.enqueue(`GET ${statusPath()}`, CONFIRMED);

      const result = await check();

      expect(result.outcome).toBe('confirmed');
      expect(mock.calls.at(-1)?.path).toBe(statusPath());
      expect(store.getState().checkoutAttempt).toEqual({ status: 'idle' });
      expect(store.getState().cart.lines).toEqual([]);
      expect(store.getState().orderHistory.orders.map(({ id }) => id)).toEqual(['order-0001']);
    });

    it('404 not created: the server never saw it, so the attempt ends and the cart is kept', async () => {
      await loseTheAnswer();
      mock.enqueue(`GET ${statusPath()}`, errorBody.notCreated);

      const result = await check();

      expect(result.outcome).toBe('notCreated');
      expect(store.getState().checkoutAttempt).toEqual({ status: 'idle' });
      expectNotConfirmed();
    });

    it('410 expired: the key is gone, so the attempt ends and the cart is kept', async () => {
      await loseTheAnswer();
      mock.enqueue(`GET ${statusPath()}`, errorBody.expired);

      const result = await check();

      expect(result.outcome).toBe('expired');
      expect(store.getState().checkoutAttempt).toEqual({ status: 'idle' });
      expectNotConfirmed();
    });

    it('202 pending keeps waiting', async () => {
      await loseTheAnswer();
      mock.enqueue(`GET ${statusPath()}`, PENDING);

      const result = await check();

      expect(result.outcome).toBe('pending');
      expect(store.getState().checkoutAttempt).toMatchObject({ status: 'unresolved', key: KEY, remoteStatus: 'pending' });
      expectNotConfirmed();
    });

    it.each([
      ['timeout', reply.timeout()],
      ['503', reply.serverError(503)],
      ['offline', reply.networkError()],
      ['409 key reused', errorBody.keyReused],
    ])('%s keeps the attempt unresolved with the same key and never confirms', async (_label, failure) => {
      await loseTheAnswer();
      // 503 and network errors are retried by the read policy: give each retry the same answer.
      mock.always(`GET ${statusPath()}`, failure);

      const result = await check();

      expect(result.outcome).not.toBe('confirmed');
      expect(store.getState().checkoutAttempt).toMatchObject({ status: 'unresolved', key: KEY });
      expectNotConfirmed();
    });

    it('a status check is ignored when there is no open attempt or the key is another one', async () => {
      const idle = await check();
      expect(idle).toMatchObject({ outcome: 'uncertain', ignored: true });

      await loseTheAnswer();
      const stale = await store.dispatch(checkOrderStatus('other-key')).unwrap();
      expect(stale).toMatchObject({ outcome: 'uncertain', ignored: true });
      expect(mock.calls.filter(({ method }) => method === 'GET')).toHaveLength(0);
    });

    it('while the attempt is open a new submit is ignored: no second POST, the key does not change', async () => {
      await loseTheAnswer();

      const result = await submit();

      expect(result).toMatchObject({ outcome: 'uncertain', ignored: true });
      expect(posts()).toHaveLength(1);
      expect(store.getState().checkoutAttempt).toMatchObject({ key: KEY });
    });

    it('after "not created" a NEW attempt may start (the lock opens only with proof)', async () => {
      await loseTheAnswer();
      mock.enqueue(`GET ${statusPath()}`, errorBody.notCreated);
      await check();

      mock.enqueue('POST /orders', CONFIRMED);
      const result = await submit();

      expect(result.outcome).toBe('confirmed');
      expect(posts().map((call) => call.headers['idempotency-key'])).toEqual(['key-0001', 'key-0002']);
    });
  });

  describe('after a restart (redux-persist + the REHYDRATE listener)', () => {
    const persisted = (attempt: unknown) =>
      createMemoryStorage({
        initial: {
          [`persist:${PERSIST_KEY}`]: JSON.stringify({
            checkoutAttempt: JSON.stringify(attempt),
            _persist: JSON.stringify({ version: PERSIST_VERSION, rehydrated: true }),
          }),
        },
      });

    it('a preliminary attempt (process killed before the answer) comes back unresolved and asks for its status with the same key', async () => {
      mock.enqueue(`GET ${statusPath('key-restored')}`, CONFIRMED);
      const restarted = createTestStore({ storage: persisted({ status: 'preliminary', key: 'key-restored', fingerprint: 'fp' }) });

      await startPersistence(restarted).rehydrated;
      await jest.advanceTimersByTimeAsync(0);

      expect(mock.calls.map(({ method, path }) => `${method} ${path}`)).toEqual([`GET ${statusPath('key-restored')}`]);
      expect(restarted.getState().checkoutAttempt).toMatchObject({ key: 'key-restored' });
      // The listener restores and queries; confirming and clearing the cart is the thunk's job.
      expect(restarted.getState().orderHistory.orders).toHaveLength(0);
    });

    it('an unreadable stored attempt starts clean and sends nothing', async () => {
      const restarted = createTestStore({ storage: persisted({ status: 'preliminary', key: 42 }) });

      await startPersistence(restarted).rehydrated;
      await jest.advanceTimersByTimeAsync(0);

      expect(restarted.getState().checkoutAttempt).toEqual({ status: 'idle' });
      expect(mock.calls).toHaveLength(0);
    });
  });
});

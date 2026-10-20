/// <reference types="jest" />
// RF-17, RF-5 (T2), RF-36, RF-38, RF-39 (T4). The idempotent order protocol on the REAL stack: store + thunks + RTK Query +
// `fetchJson` + contract parsers, over a controlled `fetch`. The pure transition table lives in
// `attempt-machine.test.ts` (node:test); this file proves the pieces are wired so that an order
// that was not confirmed by the server is never shown or recorded as confirmed.
//
// `.tsx` with no JSX: the extension only picks the runner (Jest), because it needs RTK Query,
// the store and `mock-fetch`.
//
// Compose/Android: a ViewModel test with a `MockWebServer` and `runTest`. Swift: a `URLProtocol`
// stub plus an `XCTestExpectation` per request.
import * as Crypto from 'expo-crypto';

import { PERSIST_KEY, PERSIST_VERSION } from '@/core/storage/persist-policy';
import { selectCanCheckout } from '@/features/cart/logic/cart-selectors';
import { cartCleared, productAdded } from '@/features/cart/store/cart-slice';
import { languageChanged } from '@/features/preferences/store/preferences-slice';

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
    // The stock refresh of an OUT_OF_STOCK reads the detail in the persisted language, falling back
    // to the device language: pin both paths to Spanish so the localized reply below matches.
    store.dispatch(languageChanged('es'));
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
      mock.enqueue(`GET /products/${PRODUCT.productId}`, reply.localized(wireProduct(1, { stock: 1 }), 'es'));

      const result = await submit();

      expect(mock.calls.map(({ method, path }) => `${method} ${path}`)).toContain(`GET /products/${PRODUCT.productId}`);
      expect(store.getState().cart.lines).toMatchObject([{ productId: PRODUCT.productId, quantity: 1, stock: 1 }]);
      expect(result).toMatchObject({ adjustments: [{ productId: PRODUCT.productId, previousQuantity: 2, quantity: 1 }] });
    });

    it('409 out of stock for a product that sold out: the line is removed and reported as removed', async () => {
      mock.enqueue('POST /orders', errorBody.outOfStock);
      mock.enqueue(`GET /products/${PRODUCT.productId}`, reply.localized(wireProduct(1, { stock: 0, inStock: false }), 'es'));

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

    // RF-39 (T4): a product that NO LONGER EXISTS in the API (detail 404) during the OUT_OF_STOCK
    // refresh. The refresh reads nothing and throws nothing: the LOCAL snapshot (the line) is kept,
    // the attempt still ends (spec 004 frees the key) and checkout re-enables so the line can be
    // edited — the local cart never depends on the catalog still having the product.
    it('409 out of stock with a product that disappeared (detail 404): the snapshot line is kept and stays editable', async () => {
      await startPersistence(store).rehydrated; // selectors read the persisted `rehydrated` flag
      mock.enqueue('POST /orders', errorBody.outOfStock);
      mock.always(`GET /products/${PRODUCT.productId}`, reply.clientError(404, { error: { code: 'PRODUCT_NOT_FOUND' } }));

      const result = await submit();

      expect(result).toMatchObject({ outcome: 'outOfStock', adjustments: [] });
      expect(store.getState().cart.lines).toMatchObject([
        { productId: PRODUCT.productId, name: PRODUCT.name, quantity: 2, stock: 5 },
      ]);
      expect(store.getState().checkoutAttempt).toEqual({ status: 'idle' });
      expect(selectCanCheckout(store.getState())).toBe(true);
      expectNotConfirmed();
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

    // RF-37, RF-43 (T7): the deterministic replacement for the mock's ORDER_POST_DELAY_MS. The first
    // POST is held IN FLIGHT (delayMs) and the second submit lands while it is still unanswered —
    // the exact window Maestro exercises with two taps 50 ms apart against a slow backend. The lock
    // is synchronous on `attemptSubmitted` (transitionAttempt never re-keys an open attempt), so the
    // second submit is dropped before it can mint or POST: ONE request, ONE stored key.
    it('a double tap while the first POST is in flight sends ONE request with the ONE stored key', async () => {
      mock.enqueue('POST /orders', reply.success({ status: 'confirmed', order: SUMMARY }, { delayMs: 1_500 }));

      const first = store.dispatch(submitOrder({ shippingAddress: ADDRESS }));
      await jest.advanceTimersByTimeAsync(50); // the first POST is now in flight, unanswered
      const second = store.dispatch(submitOrder({ shippingAddress: ADDRESS }));
      await jest.advanceTimersByTimeAsync(2_000); // let the delayed answer settle
      const [one, two] = [await first.unwrap(), await second.unwrap()];

      expect(posts()).toHaveLength(1); // the in-flight window does not leak a second request
      expect(posts()[0]?.headers['idempotency-key']).toBe(KEY); // the STORED key, minted once
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

  // RF-36 (T4): ONE key per attempt, minted from entropy (`randomUUID`), stable while the attempt
  // is open and never reused by a LATER attempt. The double tap proves the wire sees ONE POST with
  // the STORED key — the racing mint is discarded before it can reach anything.
  describe('RF-36: the key of an attempt', () => {
    it('is minted from entropy once per attempt: double tap -> one POST; open -> no new mint; released -> a different key', async () => {
      const uuid = jest.mocked(Crypto.randomUUID);
      uuid.mockClear();

      // The double tap: both submits race before the lock settles; only one of them can POST.
      mock.enqueue('POST /orders', reply.networkError());
      const first = store.dispatch(submitOrder({ shippingAddress: ADDRESS }));
      const second = store.dispatch(submitOrder({ shippingAddress: ADDRESS }));
      await jest.advanceTimersByTimeAsync(0);
      const [one, two] = [await first.unwrap(), await second.unwrap()];

      expect(posts()).toHaveLength(1);
      expect('ignored' in one || 'ignored' in two).toBe(true);
      expect(store.getState().checkoutAttempt).toMatchObject({ status: 'unresolved', key: KEY });
      expect(posts()[0]?.headers['idempotency-key']).toBe(KEY); // the STORED key is the one sent

      // While the attempt is open (preliminary/unresolved), another submit mints NOTHING and sends NOTHING.
      const mints = uuid.mock.calls.length;
      const again = await store.dispatch(submitOrder({ shippingAddress: ADDRESS })).unwrap();
      expect('ignored' in again).toBe(true);
      expect(uuid.mock.calls.length).toBe(mints);
      expect(posts()).toHaveLength(1);
      expect(store.getState().checkoutAttempt).toMatchObject({ key: KEY });

      // The 404 not_created pair RELEASES the attempt (spec 004: the key is done)...
      mock.enqueue(`GET ${statusPath()}`, errorBody.notCreated);
      await check();
      expect(store.getState().checkoutAttempt).toEqual({ status: 'idle' });

      // ...and the next attempt mints a NEW key from fresh entropy, which is what reaches the wire.
      mock.enqueue('POST /orders', CONFIRMED);
      await submit();

      expect(uuid.mock.calls.length).toBeGreaterThan(mints);
      const keys = posts().map(({ headers }) => headers['idempotency-key']);
      expect(keys).toHaveLength(2);
      expect(keys[0]).toBe(KEY);
      expect(keys[1]).not.toBe(KEY);
      expect(store.getState().orderHistory.orders.map(({ id }) => id)).toEqual(['order-0001']);
    });
  });

  // RF-38 (T4): what the dev logs are ALLOWED to contain. No address, no body and NO full
  // idempotency key — the `[api]` line of `GET /orders/status/:key` prints the PATH, so the path
  // itself has to be masked (`logSafePath`) or the "never contains" loop below fails.
  describe('RF-38: the log of an attempt', () => {
    it('never contains the full key, the address or the body — only masked, log-safe summaries', async () => {
      const lines: string[] = [];
      const spy = jest.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
        lines.push(args.map((part) => String(part)).join(' '));
      });

      mock.enqueue('POST /orders', PENDING); // 202: the key stays open...
      await submit();
      mock.enqueue(`GET ${statusPath()}`, CONFIRMED); // ...and the consult reuses it
      await check();
      spy.mockRestore();

      expect(lines.some((line) => line.startsWith('[api]'))).toBe(true);
      expect(lines.some((line) => line.startsWith('[orders]'))).toBe(true); // the log DID run
      for (const line of lines) {
        for (const secret of [
          ADDRESS.fullName, ADDRESS.phone, ADDRESS.postalCode, ADDRESS.state, ADDRESS.city, ADDRESS.street,
          JSON.stringify(ADDRESS), // the whole body, exterior number included
          KEY,
          'shippingAddress',
        ]) {
          expect(line).not.toContain(secret);
        }
      }
      // The masked tails survive: "the 202 and the 200 were for the same attempt" stays provable.
      expect(lines.some((line) => line.includes('key=…0001'))).toBe(true);
      expect(lines.some((line) => line.includes('/orders/status/…0001'))).toBe(true);
    });
  });
});

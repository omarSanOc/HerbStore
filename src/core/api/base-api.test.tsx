/// <reference types="jest" />
// RF-5 (T2). The REAL stack (RTK Query + retry + `fetchJson` + validators) over a controlled
// `fetch`: success, empty, 4xx, 5xx, timeout and latency, with no network and no real clock.
//
// Why `.tsx` with no JSX: the extension only selects the runner. This needs RTK Query, the store and
// `mock-fetch`, which load React Native modules, so it belongs to Jest and not to `node:test`.
//
// Compose/Android: `MockWebServer.enqueue(...)` + `runTest` with a virtual clock. Swift: a
// `URLProtocol` stub + an injected clock. Same idea: the server and the time are test inputs.
import { productsApi } from '@/features/product/data/products-api';
import { ordersApi } from '@/features/checkout/data/orders-api';
import { buildProductQueryArgs, toProductQueryString } from '@/features/product/logic/product-query';

import { createTestStore, wireBrands, wireProduct, wireProductPage } from '@/test/fixtures';
import { createMockFetch, reply } from '@/test/mock-fetch';

const ORDER = {
  idempotencyKey: 'key-0001',
  request: {
    items: [{ productId: 'product-261009-001', quantity: 1 }],
    currency: 'MXN' as const,
    shippingAddress: {
      fullName: 'Ana Perez',
      phone: '5512345678',
      postalCode: '01234',
      state: 'Jalisco',
      city: 'Guadalajara',
      street: 'Avenida Central',
      exteriorNumber: '10',
    },
  },
};

describe('RTK Query over a controlled fetch', () => {
  let mock: ReturnType<typeof createMockFetch>;
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    jest.useFakeTimers();
    mock = createMockFetch();
    mock.install();
    store = createTestStore();
  });

  afterEach(() => {
    mock.uninstall();
  });

  /** Starts a brands read; the caller decides how much fake time passes. */
  const readBrands = () => store.dispatch(productsApi.endpoints.getBrands.initiate('es'));
  const advance = (ms: number) => jest.advanceTimersByTimeAsync(ms);

  describe('success and empty', () => {
    it('success: one request, parsed data, no error', async () => {
      mock.enqueue('GET /brands', reply.localized(wireBrands(), 'es'));

      const request = readBrands();
      const result = await request;

      expect(result.isSuccess).toBe(true);
      expect(result.data).toEqual([
        { name: 'AsterVale Nutrition', productCount: 12 },
        { name: 'Fernlight Labs', productCount: 8 },
      ]);
      expect(mock.calls).toHaveLength(1);
      request.unsubscribe();
    });

    it('empty: a valid empty list is a success with nothing in it, not an error', async () => {
      mock.enqueue('GET /brands', reply.localized([], 'es'));

      const request = readBrands();
      const result = await request;

      expect(result.isSuccess).toBe(true);
      expect(result.data).toEqual([]);
      request.unsubscribe();
    });

    it('empty catalog page: the infinite query ends with one empty page and no next page', async () => {
      mock.enqueue('GET /products', reply.empty(undefined, { headers: { 'Content-Language': 'es' } }));

      const request = store.dispatch(productsApi.endpoints.getProducts.initiate(buildProductQueryArgs({ language: 'es', search: 'nothing' })));
      const result = await request;

      expect(result.isSuccess).toBe(true);
      expect(result.data?.pages).toHaveLength(1);
      expect(result.data?.pages[0]).toMatchObject({ items: [], total: 0, totalPages: 0 });
      expect(result.hasNextPage).toBe(false);
      expect(mock.calls).toHaveLength(1);
      expect(mock.calls[0]?.url).toContain('q=nothing');
      request.unsubscribe();
    });

    it('a normal catalog page reports a next page and keeps request and pages in step', async () => {
      mock.enqueue('GET /products', reply.localized(wireProductPage(3, { totalPages: 2, total: 5 }), 'es'));

      const request = store.dispatch(productsApi.endpoints.getProducts.initiate(buildProductQueryArgs({ language: 'es' })));
      const result = await request;

      expect(result.data?.pages[0]?.items).toHaveLength(3);
      expect(result.hasNextPage).toBe(true);
      request.unsubscribe();
    });

    it('a product detail carries the live stock', async () => {
      mock.enqueue('GET /products/product-261009-001', reply.localized(wireProduct(1, { stock: 7 }), 'es'));

      const request = store.dispatch(productsApi.endpoints.getProduct.initiate({ id: 'product-261009-001', language: 'es' }));
      const result = await request;

      expect(result.data).toMatchObject({ id: 'product-261009-001', stock: 7, inStock: true });
      request.unsubscribe();
    });
  });

  describe('4xx: the request is wrong, so it is never retried', () => {
    it.each([400, 404, 409, 422, 429])('%i: one request, even after the longest backoff', async (status) => {
      mock.enqueue('GET /brands', reply.clientError(status));

      const request = readBrands();
      const result = await request;
      await advance(5_000);

      expect(result.isError).toBe(true);
      expect(result.error).toEqual({ kind: 'http', status });
      expect(mock.calls).toHaveLength(1);
      request.unsubscribe();
    });
  });

  describe('5xx: two retries, at 500 ms and 1000 ms', () => {
    it('a persistent 503 makes exactly three requests, spaced by the backoff, and then fails', async () => {
      mock.always('GET /brands', reply.serverError(503));

      const request = readBrands();
      await advance(0);
      expect(mock.calls).toHaveLength(1);

      await advance(499);
      expect(mock.calls).toHaveLength(1);
      await advance(1);
      expect(mock.calls).toHaveLength(2);

      await advance(999);
      expect(mock.calls).toHaveLength(2);
      await advance(1);
      expect(mock.calls).toHaveLength(3);

      const result = await request;
      await advance(60_000);
      expect(result.isError).toBe(true);
      expect(result.error).toEqual({ kind: 'http', status: 503 });
      expect(mock.calls).toHaveLength(3);
      request.unsubscribe();
    });

    it('recovers when the server comes back after the first retry: data, no error, two requests', async () => {
      mock.enqueue('GET /brands', reply.serverError(500), reply.localized(wireBrands(), 'es'));

      const request = readBrands();
      await advance(500);
      const result = await request;

      expect(result.isSuccess).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(mock.calls).toHaveLength(2);
      request.unsubscribe();
    });

    it('a 5xx on a different read endpoint follows the same policy (product detail)', async () => {
      mock.always('GET /products/product-261009-001', reply.serverError(502));

      const request = store.dispatch(productsApi.endpoints.getProduct.initiate({ id: 'product-261009-001', language: 'es' }));
      await advance(1_500);
      const result = await request;

      expect(result.error).toEqual({ kind: 'http', status: 502 });
      expect(mock.calls).toHaveLength(3);
      request.unsubscribe();
    });
  });

  describe('network failure (offline)', () => {
    it('is retried twice like a 5xx and ends as network, which the UI reads as offline', async () => {
      mock.always('GET /brands', reply.networkError());

      const request = readBrands();
      await advance(1_500);
      const result = await request;

      expect(result.error).toEqual({ kind: 'network' });
      expect(mock.calls).toHaveLength(3);
      request.unsubscribe();
    });
  });

  describe('timeout: the user already waited 8 s, so no retry', () => {
    it('gives up at exactly 8000 ms and makes a single request', async () => {
      mock.enqueue('GET /brands', reply.timeout());

      const request = readBrands();
      await advance(7_999);
      expect(store.getState().api.queries['getBrands("es")']?.status).toBe('pending');

      await advance(1);
      const result = await request;
      await advance(60_000);

      expect(result.isError).toBe(true);
      expect(result.error).toEqual({ kind: 'timeout' });
      expect(mock.calls).toHaveLength(1);
      request.unsubscribe();
    });

    it('a slow answer that arrives after the limit is still a timeout', async () => {
      mock.enqueue('GET /brands', reply.localized(wireBrands(), 'es', { delayMs: 9_000 }));

      const request = readBrands();
      await advance(8_000);
      const result = await request;

      expect(result.error).toEqual({ kind: 'timeout' });
      expect(mock.calls).toHaveLength(1);
      request.unsubscribe();
    });
  });

  describe('latency', () => {
    it('stays pending until the answer arrives, then fulfils, with no real waiting', async () => {
      mock.enqueue('GET /brands', reply.localized(wireBrands(), 'es', { delayMs: 3_000 }));

      const request = readBrands();
      await advance(2_999);
      const during = productsApi.endpoints.getBrands.select('es')(store.getState());
      expect(during.status).toBe('pending');
      expect(during.data).toBeUndefined();

      await advance(1);
      const result = await request;
      expect(result.isSuccess).toBe(true);
      expect(productsApi.endpoints.getBrands.select('es')(store.getState()).status).toBe('fulfilled');
      request.unsubscribe();
    });

    it('a slow 503 delays the retry: latency, then backoff', async () => {
      mock.enqueue('GET /brands', reply.serverError(503, undefined, { delayMs: 2_000 }), reply.localized(wireBrands(), 'es'));

      const request = readBrands();
      await advance(2_000); // first answer
      expect(mock.calls).toHaveLength(1);
      await advance(499);
      expect(mock.calls).toHaveLength(1);
      await advance(1); // backoff over
      const result = await request;

      expect(result.isSuccess).toBe(true);
      expect(mock.calls).toHaveLength(2);
      request.unsubscribe();
    });
  });

  describe('invalid payload', () => {
    it('a 2xx that breaks the contract is invalid and is not retried', async () => {
      mock.enqueue('GET /brands', reply.localized({ unexpected: true }, 'es'));

      const request = readBrands();
      const result = await request;
      await advance(5_000);

      expect(result.error).toEqual({ kind: 'invalid' });
      expect(mock.calls).toHaveLength(1);
      request.unsubscribe();
    });

    it('one malformed product invalidates the whole page', async () => {
      const page = wireProductPage(3);
      (page.items as Record<string, unknown>[])[1] = { id: 'broken' };
      mock.enqueue('GET /products', reply.localized(page, 'es'));

      const request = store.dispatch(productsApi.endpoints.getProducts.initiate(buildProductQueryArgs({ language: 'es' })));
      const result = await request;

      expect(result.isError).toBe(true);
      expect(result.error).toEqual({ kind: 'invalid' });
      request.unsubscribe();
    });
  });

  describe('a write (POST /orders) is never replayed by the retry policy', () => {
    const create = () => store.dispatch(ordersApi.endpoints.createOrder.initiate(ORDER));

    it.each([
      ['503', reply.serverError(503)],
      ['network failure', reply.networkError()],
    ])('%s: one request, because the first one may have been processed', async (_label, failure) => {
      mock.always('POST /orders', failure);

      const pending = create();
      await advance(5_000);
      const result = await pending;

      expect(result.error).toBeDefined();
      expect(mock.calls).toHaveLength(1);
    });

    it('timeout: one request and the outcome is a timeout, never a guess', async () => {
      mock.enqueue('POST /orders', reply.timeout());

      const pending = create();
      await advance(8_000);
      const result = await pending;

      expect(result.error).toEqual({ kind: 'timeout' });
      expect(mock.calls).toHaveLength(1);
    });

    it('sends the stable Idempotency-Key and the JSON body', async () => {
      mock.enqueue('POST /orders', reply.success({ status: 'pending', retryAfterSeconds: 1 }, { status: 202 }));

      await create();

      expect(mock.calls[0]?.headers['idempotency-key']).toBe('key-0001');
      expect(mock.calls[0]?.body).toEqual(ORDER.request);
    });
  });

  it('an unanswered route fails loudly instead of reaching a real network', async () => {
    const request = readBrands();
    await advance(1_500);
    const result = await request;

    expect(result.error).toEqual({ kind: 'network' });
    expect(mock.unmatched).toEqual(['GET /brands', 'GET /brands', 'GET /brands']);
    request.unsubscribe();
  });

  // RF-24, RF-26, RNF-3, RNF-5 (T2). The language is part of the ARGUMENT of a localized query,
  // so RTK Query's own identity gives two caches, deduplicates an equivalent query and keeps a
  // late answer inside the entry it belongs to.
  describe('localized reads: the language is part of the query identity', () => {
    it('es and en are two independent entries, and each request carries its own Accept-Language', async () => {
      mock.enqueue('GET /brands', reply.localized(wireBrands(), 'es'), reply.localized(wireBrands(), 'en'));

      const spanish = store.dispatch(productsApi.endpoints.getBrands.initiate('es'));
      const english = store.dispatch(productsApi.endpoints.getBrands.initiate('en'));
      const [first, second] = await Promise.all([spanish, english]);

      expect(first.isSuccess).toBe(true);
      expect(second.isSuccess).toBe(true);
      expect(mock.calls).toHaveLength(2);
      expect(mock.calls.map(({ headers }) => headers['accept-language'])).toEqual(['es', 'en']);

      // Two entries, each holding its own answer (the same payload, but they are not shared).
      expect(productsApi.endpoints.getBrands.select('es')(store.getState()).data).toHaveLength(2);
      expect(productsApi.endpoints.getBrands.select('en')(store.getState()).data).toHaveLength(2);
      expect(productsApi.endpoints.getBrands.select('es')(store.getState())).not.toBe(
        productsApi.endpoints.getBrands.select('en')(store.getState()),
      );
      spanish.unsubscribe();
      english.unsubscribe();
    });

    it('one request per equivalent query: the same language deduplicates, another language does not', async () => {
      mock.enqueue('GET /brands', reply.localized(wireBrands(), 'es', { delayMs: 1_000 }));
      mock.enqueue('GET /brands', reply.localized(wireBrands(), 'en'));

      const first = store.dispatch(productsApi.endpoints.getBrands.initiate('es'));
      const sameAgain = store.dispatch(productsApi.endpoints.getBrands.initiate('es'));
      const otherLanguage = store.dispatch(productsApi.endpoints.getBrands.initiate('en'));
      await advance(0);

      // Two subscribers for `es`, but only ONE request in flight for that identity.
      expect(mock.calls).toHaveLength(2);
      expect(mock.calls.map(({ headers }) => headers['accept-language'])).toEqual(['es', 'en']);

      await advance(1_000);
      await Promise.all([first, sameAgain, otherLanguage]);
      expect(mock.calls).toHaveLength(2);
      first.unsubscribe();
      sameAgain.unsubscribe();
      otherLanguage.unsubscribe();
    });

    it('a list identity changes with the language, so the page of `es` is never the page of `en`', async () => {
      const spanish = buildProductQueryArgs({ language: 'es', search: 'zinc' });
      const english = buildProductQueryArgs({ language: 'en', search: 'zinc' });

      expect(spanish).not.toEqual(english);
      // The language is identity, NOT a query parameter of `GET /products`.
      expect(toProductQueryString(spanish, 1)).not.toContain('language');
      expect(toProductQueryString(spanish, 1)).toBe(toProductQueryString(english, 1));
    });
  });
});

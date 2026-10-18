/// <reference types="jest" />
// The extension (`.tsx`) only selects the runner (Jest); this file has no JSX. It proves the
// controlled fetch on the real stack: `fetchJson` first, then a real RTK Query endpoint.
import { fetchJson } from '@/core/network/http';
import { productsApi } from '@/features/product/data/products-api';
import { parseBrandOptions, parseProductPage } from '@/features/product/contracts/parse-catalog-product';

import { wireBrands, wireProductPage, createTestStore } from './fixtures';
import { createMockFetch, reply } from './mock-fetch';

const ORIGIN = 'http://api.test';

describe('createMockFetch with fetchJson', () => {
  let mock: ReturnType<typeof createMockFetch>;

  beforeEach(() => {
    jest.useFakeTimers();
    mock = createMockFetch();
    mock.install();
  });

  afterEach(() => mock.uninstall());

  const getPage = (timeoutMs?: number) =>
    fetchJson(`${ORIGIN}/products?page=1`, { parse: parseProductPage, timeoutMs });

  it('success: answers 200 with the body', async () => {
    mock.enqueue('GET /products', reply.success(wireProductPage(2)));
    const outcome = await getPage();
    expect(outcome.kind).toBe('ok');
    expect(outcome.kind === 'ok' && outcome.data.items).toHaveLength(2);
  });

  it('empty: a valid page with no items', async () => {
    mock.enqueue('/products', reply.empty());
    const outcome = await getPage();
    expect(outcome.kind === 'ok' && outcome.data).toMatchObject({ items: [], total: 0, totalPages: 0 });
  });

  it('4xx: reports the status', async () => {
    mock.enqueue('/products', reply.clientError(404));
    expect(await getPage()).toEqual({ kind: 'http', status: 404 });
  });

  it('5xx: reports the status', async () => {
    mock.enqueue('/products', reply.serverError(503));
    expect(await getPage()).toEqual({ kind: 'http', status: 503 });
  });

  it('network failure: no response at all', async () => {
    mock.enqueue('/products', reply.networkError());
    expect(await getPage()).toEqual({ kind: 'network' });
  });

  it('timeout: never answers, so the request timer decides, with no real waiting', async () => {
    mock.enqueue('/products', reply.timeout());
    const pending = getPage(8_000);
    await jest.advanceTimersByTimeAsync(7_999);
    let settled = false;
    void pending.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(await pending).toEqual({ kind: 'timeout' });
  });

  it('latency: answers only after the fake clock reaches the delay', async () => {
    mock.enqueue('/products', reply.success(wireProductPage(1), { delayMs: 3_000 }));
    const pending = getPage();
    let settled = false;
    void pending.then(() => (settled = true));

    await jest.advanceTimersByTimeAsync(2_999);
    expect(settled).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect((await pending).kind).toBe('ok');
  });

  it('a delay longer than the timeout becomes a timeout', async () => {
    mock.enqueue('/products', reply.success(wireProductPage(1), { delayMs: 9_000 }));
    const pending = getPage(8_000);
    await jest.advanceTimersByTimeAsync(8_000);
    expect(await pending).toEqual({ kind: 'timeout' });
  });

  it('queues answer in order and record each call', async () => {
    mock.enqueue('GET /products', reply.serverError(500), reply.success(wireProductPage(1)));
    expect((await getPage()).kind).toBe('http');
    expect((await getPage()).kind).toBe('ok');
    expect(mock.calls.map(({ method, path }) => `${method} ${path}`)).toEqual(['GET /products', 'GET /products']);
    expect(mock.remaining('/products')).toBe(0);
  });

  it('routes by method and path, and `always` repeats', async () => {
    mock.enqueue('POST /orders', reply.success({ ok: true }, { status: 202 }));
    mock.always('GET /brands', reply.success(wireBrands()));
    const first = await fetchJson(`${ORIGIN}/brands`, { parse: parseBrandOptions });
    const second = await fetchJson(`${ORIGIN}/brands`, { parse: parseBrandOptions });
    expect(first.kind).toBe('ok');
    expect(second.kind).toBe('ok');
    expect(mock.remaining('POST /orders')).toBe(1);
  });

  it('an unexpected request fails loudly and is recorded', async () => {
    expect(await getPage()).toEqual({ kind: 'network' });
    expect(mock.unmatched).toEqual(['GET /products']);
  });

  it('install/uninstall swap the global fetch', () => {
    expect(globalThis.fetch).toBe(mock.fetch);
    mock.uninstall();
    expect(globalThis.fetch).not.toBe(mock.fetch);
  });
});

describe('createMockFetch with a real RTK Query endpoint', () => {
  it('serves the query and replays a 503 with the deterministic backoff (500 ms, 1000 ms)', async () => {
    jest.useFakeTimers();
    const mock = createMockFetch();
    mock.install();
    mock.enqueue('GET /brands', reply.serverError(503), reply.serverError(503), reply.success(wireBrands()));
    const store = createTestStore();

    const request = store.dispatch(productsApi.endpoints.getBrands.initiate());
    await jest.advanceTimersByTimeAsync(0);
    expect(mock.calls).toHaveLength(1);
    await jest.advanceTimersByTimeAsync(500);
    expect(mock.calls).toHaveLength(2);
    await jest.advanceTimersByTimeAsync(1_000);

    const result = await request;
    expect(result.data).toHaveLength(2);
    expect(mock.calls).toHaveLength(3);
    request.unsubscribe();
    mock.uninstall();
  });

  it('does not retry a 4xx', async () => {
    jest.useFakeTimers();
    const mock = createMockFetch();
    mock.install();
    mock.enqueue('GET /brands', reply.clientError(404));
    const store = createTestStore();

    const request = store.dispatch(productsApi.endpoints.getBrands.initiate());
    const result = await request;
    expect(result.isError).toBe(true);
    expect(mock.calls).toHaveLength(1);
    request.unsubscribe();
    mock.uninstall();
  });
});

/// <reference types="jest" />
// The extension (`.tsx`) only selects the runner (Jest); this file has no JSX. It proves the
// controlled fetch on the real stack: `fetchJson` first, then a real RTK Query endpoint.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

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

  it('does not add Content-Language to ordinary success replies', async () => {
    mock.enqueue('/products', reply.success(wireProductPage(1)));

    const response = await mock.fetch(`${ORIGIN}/products`);

    expect(response.headers.get('Content-Language')).toBeNull();
  });

  it('models response headers and localized replies explicitly', async () => {
    mock.enqueue(
      '/products',
      reply.success(wireProductPage(1), { headers: { 'X-Test-Response': 'present' } }),
      reply.localized(wireProductPage(1), 'en'),
    );

    const responseWithCustomHeader = await mock.fetch(`${ORIGIN}/products`);
    const localizedResponse = await mock.fetch(`${ORIGIN}/products`);

    expect(responseWithCustomHeader.headers.get('X-Test-Response')).toBe('present');
    expect(responseWithCustomHeader.headers.get('Content-Language')).toBeNull();
    expect(localizedResponse.headers.get('Content-Language')).toBe('en');
  });

  it('supports the localized fetchJson contract end to end', async () => {
    mock.enqueue('/products', reply.localized(wireProductPage(1), 'es'));

    const outcome = await fetchJson(`${ORIGIN}/products`, {
      language: 'es',
      parse: parseProductPage,
    });

    expect(outcome.kind).toBe('ok');
    expect(mock.calls[0]?.headers['accept-language']).toBe('es');
  });

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
    mock.enqueue('GET /brands', reply.serverError(503), reply.serverError(503), reply.localized(wireBrands(), 'es'));
    const store = createTestStore();

    const request = store.dispatch(productsApi.endpoints.getBrands.initiate('es'));
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

    const request = store.dispatch(productsApi.endpoints.getBrands.initiate('es'));
    const result = await request;
    expect(result.isError).toBe(true);
    expect(mock.calls).toHaveLength(1);
    request.unsubscribe();
    mock.uninstall();
  });
});

// RF-22/RF-23 (T1/T2): every controlled 2xx reply for a localized-copy endpoint has to declare
// `Content-Language` explicitly, so a test models the real boundary instead of leaning on a
// lenient helper. `reply.localized` does it; a plain `reply.success`/`reply.empty` on those
// routes without the header would silently answer something the API cannot send.
describe('the suite declares Content-Language on localized replies (RF-22)', () => {
  const SRC = join(process.cwd(), 'src');
  const SELF = join(SRC, 'test', 'mock-fetch.test.tsx');
  /** A localized-copy route (RF-22): `/images/...` and `/orders/...` are deliberately out. */
  const LOCALIZED_ROUTE = /(^|[\s('"])\/(home|products|categories|brands)(\/|[?'\s]|$)/;
  const NON_LOCALIZED_BUILDER = /reply\.(success|empty)\(/;

  /** The arguments of every `.enqueue(`/`.always(` call, balanced by parenthesis counting. */
  function replyBlocks(text: string): string[] {
    const blocks: string[] = [];
    for (const match of text.matchAll(/\.(?:enqueue|always)\(/g)) {
      const start = match.index! + match[0].length;
      let depth = 1;
      let end = start;
      for (; end < text.length && depth > 0; end += 1) {
        if (text[end] === '(') depth += 1;
        else if (text[end] === ')') depth -= 1;
      }
      blocks.push(text.slice(start, end - 1));
    }
    return blocks;
  }

  function testFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return testFiles(path);
      return /\.test\.tsx?$/.test(entry.name) && path !== SELF ? [path] : [];
    });
  }

  it('answers every localized route with an explicit Content-Language', () => {
    const offenders = testFiles(SRC).flatMap((path) =>
      replyBlocks(readFileSync(path, 'utf8'))
        .filter(
          (block) =>
            LOCALIZED_ROUTE.test(block) && NON_LOCALIZED_BUILDER.test(block) && !block.includes('Content-Language'),
        )
        .map((block) => `${path}: ${block.slice(0, 90)}`),
    );
    expect(offenders).toEqual([]);
  });

  it('really scans the suite (the route list would pass vacuously otherwise)', () => {
    const files = testFiles(SRC);
    expect(files.length).toBeGreaterThan(50);
    expect(files.some((path) => readFileSync(path, 'utf8').includes('reply.localized'))).toBe(true);
  });
});

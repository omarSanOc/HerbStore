/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createFetchJsonBaseQuery, type SettledRequest } from './fetch-json-base-query.ts';

type FetchImpl = NonNullable<Parameters<typeof createFetchJsonBaseQuery>[0]['fetchImpl']>;

// Mirror of node_modules/expo/src/winter/fetch/FetchErrors.ts: expo/fetch rejects with an Error, not a TypeError.
class FetchError extends Error {
  constructor(message: string) {
    super(`fetch failed: ${message}`);
  }
}

function parseName(payload: unknown): string | undefined {
  if (typeof payload === 'object' && payload !== null && 'name' in payload) {
    const { name } = payload;
    return typeof name === 'string' ? name : undefined;
  }
  return undefined;
}

function jsonResponse(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...Object.fromEntries(new Headers(headers)) },
  });
}

/** The slice of `BaseQueryApi` that this base query reads. */
function apiWith(signal: AbortSignal) {
  return { signal } as Parameters<ReturnType<typeof createFetchJsonBaseQuery>>[1];
}

function run(
  fetchImpl: FetchImpl,
  args: Parameters<ReturnType<typeof createFetchJsonBaseQuery>>[0],
  signal: AbortSignal = new AbortController().signal,
  onSettled?: (event: SettledRequest) => void,
) {
  const baseQuery = createFetchJsonBaseQuery({ origin: 'http://api.test', fetchImpl, onSettled });
  return baseQuery(args, apiWith(signal), {});
}

describe('createFetchJsonBaseQuery', () => {
  it('returns { data } when the payload passes parse', async () => {
    const result = await run(async () => jsonResponse({ name: 'Vitamin C' }), {
      path: '/products/p1',
      parse: parseName,
    });

    assert.deepEqual(result, { data: 'Vitamin C' });
  });

  it('prefixes the path with the origin and defaults to GET', async () => {
    let seen: { url: string; method: string | undefined } | undefined;

    await run(
      async (url, init) => {
        seen = { url, method: init?.method };
        return jsonResponse({ name: 'x' });
      },
      { path: '/home?fail=true', parse: parseName },
    );

    assert.deepEqual(seen, { url: 'http://api.test/home?fail=true', method: 'GET' });
  });

  it('forwards the localized opt-in and maps a matching response to data', async () => {
    let requestHeaders: Headers | undefined;

    const result = await run(
      async (_url, init) => {
        requestHeaders = new Headers(init?.headers);
        return jsonResponse({ name: 'Home' }, 200, { 'Content-Language': 'en' });
      },
      { path: '/home', language: 'en', parse: parseName },
    );

    assert.equal(requestHeaders?.get('Accept-Language'), 'en');
    assert.deepEqual(result, { data: 'Home' });
  });

  it('maps a missing, invalid or different localized response header to invalid', async () => {
    for (const contentLanguage of [undefined, 'fr', 'en'] as const) {
      const result = await run(
        async () =>
          jsonResponse(
            { name: 'Inicio' },
            200,
            contentLanguage === undefined ? {} : { 'Content-Language': contentLanguage },
          ),
        { path: '/home', language: 'es', parse: parseName },
      );

      assert.deepEqual(result, { error: { kind: 'invalid' } });
    }
  });

  it('keeps non-localized health and order responses compatible without Content-Language', async () => {
    const health = await run(async () => jsonResponse({ name: 'healthy' }), {
      path: '/health',
      parse: parseName,
    });
    const order = await run(async () => jsonResponse({ name: 'confirmed' }), {
      path: '/orders',
      method: 'POST',
      body: {},
      parse: parseName,
    });

    assert.deepEqual(health, { data: 'healthy' });
    assert.deepEqual(order, { data: 'confirmed' });
  });

  it('maps a rejection with FetchError (no response) to { error: { kind: network } }', async () => {
    const result = await run(
      async () => {
        throw new FetchError('Failed to connect to /127.0.0.1:3001');
      },
      { path: '/home', parse: parseName },
    );

    assert.deepEqual(result, { error: { kind: 'network' } });
  });

  it('maps a 503 to http 503 and a 404 to http 404', async () => {
    const unavailable = await run(async () => jsonResponse({ error: {} }, 503), {
      path: '/home',
      parse: parseName,
    });
    const notFound = await run(async () => jsonResponse({ error: {} }, 404), {
      path: '/products/p1',
      parse: parseName,
    });

    assert.deepEqual(unavailable, { error: { kind: 'http', status: 503 } });
    assert.deepEqual(notFound, { error: { kind: 'http', status: 404 } });
  });

  it('maps invalid JSON and a payload rejected by parse to invalid', async () => {
    const notJson = await run(async () => new Response('<html></html>', { status: 200 }), {
      path: '/home',
      parse: parseName,
    });
    const wrongShape = await run(async () => jsonResponse({ unexpected: true }), {
      path: '/home',
      parse: parseName,
    });

    assert.deepEqual(notJson, { error: { kind: 'invalid' } });
    assert.deepEqual(wrongShape, { error: { kind: 'invalid' } });
  });

  it('maps an abort of the RTK signal to aborted, even if fetch rejects with a FetchError', async () => {
    const controller = new AbortController();
    const abortedFetch: FetchImpl = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new FetchError('The operation was aborted.'));
        });
      });

    const pending = run(abortedFetch, { path: '/home', parse: parseName }, controller.signal);
    controller.abort();

    assert.deepEqual(await pending, { error: { kind: 'aborted' } });
  });

  it('a POST sends Idempotency-Key, Content-Type and the serialized body', async () => {
    let seen: RequestInit | undefined;

    const result = await run(
      async (_url, init) => {
        seen = init;
        return jsonResponse({ name: 'confirmed' }, 200);
      },
      {
        path: '/orders',
        method: 'POST',
        body: { currency: 'MXN', items: [{ productId: 'p1', quantity: 1 }] },
        headers: { 'Idempotency-Key': 'attempt-1' },
        parse: parseName,
      },
    );

    assert.deepEqual(result, { data: 'confirmed' });
    assert.equal(seen?.method, 'POST');
    assert.equal(seen?.body, '{"currency":"MXN","items":[{"productId":"p1","quantity":1}]}');
    assert.deepEqual(seen?.headers, {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Idempotency-Key': 'attempt-1',
    });
  });

  it('reports every settled request to onSettled without the query string, headers or body', async () => {
    const events: SettledRequest[] = [];

    await run(
      async () => jsonResponse({ name: 'x' }, 200, { 'Content-Language': 'es' }),
      {
        path: '/products?q=vitamina&page=1',
        language: 'es',
        headers: { 'X-Private-Input': 'do-not-log' },
        parse: parseName,
      },
      undefined,
      (event) => events.push(event),
    );
    await run(
      async () => jsonResponse({ error: {} }, 503),
      {
        path: '/orders',
        method: 'POST',
        body: { address: 'secret' },
        headers: { 'Idempotency-Key': 'k' },
        parse: parseName,
      },
      undefined,
      (event) => events.push(event),
    );

    assert.deepEqual(events, [
      { method: 'GET', path: '/products', result: 'ok' },
      { method: 'POST', path: '/orders', result: 'http', status: 503 },
    ]);
  });
});

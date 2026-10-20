/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createFetchJsonBaseQuery } from '../../../core/api/fetch-json-base-query.ts';
import { wirePayload } from '../testing/home-test-data.ts';
import { buildHomeRequest } from './home-request.ts';

type FetchImpl = NonNullable<Parameters<typeof createFetchJsonBaseQuery>[0]['fetchImpl']>;

const ORIGIN = 'http://localhost:3001';

// `expo/fetch` rejects with a `FetchError extends Error`, never with a `TypeError`.
class FetchError extends Error {}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      // Every request here is localized (`buildHomeRequest('es', ...)`), so a 2xx has to name the
      // language it answers in; the boundary validates it (T1). Errors never carry it.
      ...(status >= 200 && status < 300 ? { 'Content-Language': 'es' } : {}),
    },
  });
}

/** Runs the request the way RTK Query does: the endpoint's args go through the base query. */
async function run(
  request: ReturnType<typeof buildHomeRequest>,
  fetchImpl: FetchImpl,
  signal: AbortSignal = new AbortController().signal,
) {
  const baseQuery = createFetchJsonBaseQuery({ origin: ORIGIN, fetchImpl });
  return baseQuery(request, { signal } as Parameters<typeof baseQuery>[1], {});
}

describe('buildHomeRequest', () => {
  it('requests GET /home, without a query string', () => {
    assert.equal(buildHomeRequest('es').path, '/home');
  });

  it('reaches the given origin with GET /home', async () => {
    const urls: string[] = [];

    await run(buildHomeRequest('es'), async (url) => {
      urls.push(String(url));
      return jsonResponse(wirePayload());
    });

    assert.deepEqual(urls, ['http://localhost:3001/home']);
  });

  it('parse validates a server payload into HomeData', () => {
    const data = buildHomeRequest('es').parse(wirePayload());

    assert.equal(data?.banners.length, 2);
    assert.equal(data?.categories.length, 2);
    assert.equal(data?.sections.length, 3);
  });

  it('parse gives undefined for a payload that breaks the contract', () => {
    assert.equal(buildHomeRequest('es').parse({ banners: 'nope' }), undefined);
    assert.equal(buildHomeRequest('es').parse(null), undefined);
  });

  it('a malformed element invalidates the whole payload', () => {
    const payload = wirePayload();
    const sections = payload.sections as { items: Record<string, unknown>[] }[];
    sections[0]!.items[0]!.price = 'free';

    assert.equal(buildHomeRequest('es').parse(payload), undefined);
  });
});

describe('buildHomeRequest outcomes through the base query', () => {
  it('maps ok, network (FetchError), 500 and an unusable body like Day 2', async () => {
    const request = buildHomeRequest('es');

    const ok = await run(request, async () => jsonResponse(wirePayload()));
    const network = await run(request, async () => {
      throw new FetchError('Network request failed');
    });
    const serverError = await run(request, async () =>
      jsonResponse({ error: { code: 'SIMULATED_FAILURE' } }, 500),
    );
    const invalid = await run(request, async () => jsonResponse({ banners: 'nope' }));

    assert.equal(ok.data !== undefined, true);
    assert.deepEqual(network.error, { kind: 'network' });
    assert.deepEqual(serverError.error, { kind: 'http', status: 500 });
    assert.deepEqual(invalid.error, { kind: 'invalid' });
  });

  it('reports aborted when the caller cancels', async () => {
    const controller = new AbortController();
    const hangingFetch: FetchImpl = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      });

    const pending = run(buildHomeRequest('es'), hangingFetch, controller.signal);
    controller.abort();

    assert.deepEqual((await pending).error, { kind: 'aborted' });
  });

  it('times out after 8 seconds', async (context) => {
    const hangingFetch: FetchImpl = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      });
    context.mock.timers.enable({ apis: ['setTimeout'] });

    let settled = false;
    const pending = run(buildHomeRequest('es'), hangingFetch).then((result) => {
      settled = true;
      return result;
    });

    context.mock.timers.tick(7_999);
    await Promise.resolve();
    assert.equal(settled, false);

    context.mock.timers.tick(1);
    assert.deepEqual((await pending).error, { kind: 'timeout' });
  });
});

describe('buildHomeRequest language contract (RF-22, RF-23)', () => {
  it('the language is part of the request, so es and en are different identities', () => {
    assert.equal(buildHomeRequest('es').language, 'es');
    assert.equal(buildHomeRequest('en').language, 'en');
    assert.notDeepEqual(buildHomeRequest('es'), buildHomeRequest('en'));
    // The language is NOT a query parameter: the path stays `/home`.
    assert.equal(buildHomeRequest('en').path, '/home');
  });

  it('sends Accept-Language and accepts a 2xx only when Content-Language matches it exactly', async () => {
    const asked: (string | null)[] = [];
    const ask = (contentLanguage: string | null) => {
      return run(buildHomeRequest('en'), async (_url, init) => {
        asked.push(new Headers(init?.headers).get('Accept-Language'));
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (contentLanguage !== null) headers['Content-Language'] = contentLanguage;
        return new Response(JSON.stringify(wirePayload()), { status: 200, headers });
      });
    };

    const matching = await ask('en');
    const otherLanguage = await ask('es');
    const missing = await ask(null);
    const unsupported = await ask('fr');

    assert.equal(matching.data !== undefined, true);
    assert.deepEqual(otherLanguage.error, { kind: 'invalid' });
    assert.deepEqual(missing.error, { kind: 'invalid' });
    assert.deepEqual(unsupported.error, { kind: 'invalid' });
    assert.deepEqual(asked, ['en', 'en', 'en', 'en']);
  });
});

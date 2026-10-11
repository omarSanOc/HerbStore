/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { wirePayload } from '../testing/home-test-data.ts';
import { fetchHome, HOME_TIMEOUT_MS } from './home-client.ts';

type FetchImpl = NonNullable<Parameters<typeof fetchHome>[0]['fetchImpl']>;

const ORIGIN = 'http://localhost:3001';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const hangingFetch: FetchImpl = (_url, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => {
      reject(new DOMException('The operation was aborted.', 'AbortError'));
    });
  });

describe('fetchHome', () => {
  it('requests GET /home on the given origin', async () => {
    const urls: string[] = [];

    await fetchHome({
      origin: ORIGIN,
      fetchImpl: async (url) => {
        urls.push(String(url));
        return jsonResponse(wirePayload());
      },
    });

    assert.deepEqual(urls, ['http://localhost:3001/home']);
  });

  it('returns ok with validated HomeData', async () => {
    const outcome = await fetchHome({
      origin: ORIGIN,
      fetchImpl: async () => jsonResponse(wirePayload()),
    });

    assert.equal(outcome.kind, 'ok');
    assert.equal(outcome.kind === 'ok' && outcome.data.banners.length, 2);
    assert.equal(outcome.kind === 'ok' && outcome.data.sections.length, 3);
  });

  it('maps a fetch TypeError to network, a 500 to http, and an unusable body to invalid', async () => {
    const network = await fetchHome({
      origin: ORIGIN,
      fetchImpl: async () => {
        throw new TypeError('Network request failed');
      },
    });
    const serverError = await fetchHome({
      origin: ORIGIN,
      fetchImpl: async () => jsonResponse({ error: { code: 'SIMULATED_FAILURE' } }, 500),
    });
    const invalid = await fetchHome({
      origin: ORIGIN,
      fetchImpl: async () => jsonResponse({ banners: 'nope' }),
    });

    assert.deepEqual(network, { kind: 'network' });
    assert.deepEqual(serverError, { kind: 'http', status: 500 });
    assert.deepEqual(invalid, { kind: 'invalid' });
  });

  it('reports aborted when the caller cancels', async () => {
    const controller = new AbortController();
    const pending = fetchHome({ origin: ORIGIN, fetchImpl: hangingFetch, signal: controller.signal });
    controller.abort();

    assert.deepEqual(await pending, { kind: 'aborted' });
  });

  it('times out after 8 seconds by default', async (context) => {
    assert.equal(HOME_TIMEOUT_MS, 8_000);
    context.mock.timers.enable({ apis: ['setTimeout'] });

    let settled = false;
    const pending = fetchHome({ origin: ORIGIN, fetchImpl: hangingFetch }).then((outcome) => {
      settled = true;
      return outcome;
    });

    context.mock.timers.tick(7_999);
    await Promise.resolve();
    assert.equal(settled, false);

    context.mock.timers.tick(1);
    assert.deepEqual(await pending, { kind: 'timeout' });
  });

  it('honours an explicit timeout', async () => {
    const outcome = await fetchHome({ origin: ORIGIN, fetchImpl: hangingFetch, timeoutMs: 20 });

    assert.deepEqual(outcome, { kind: 'timeout' });
  });
});

describe('fetchHome fixtures', () => {
  it('without a fixture the data is untouched', async () => {
    const outcome = await fetchHome({
      origin: ORIGIN,
      fetchImpl: async () => jsonResponse(wirePayload()),
    });

    assert.equal(outcome.kind === 'ok' && outcome.data.banners.length, 2);
  });

  it('server-fail asks the real server for its simulated failure', async () => {
    const urls: string[] = [];
    const outcome = await fetchHome({
      origin: ORIGIN,
      fixture: 'server-fail',
      fetchImpl: async (url) => {
        urls.push(String(url));
        return jsonResponse({ error: { code: 'SIMULATED_FAILURE', message: 'x' } }, 500);
      },
    });

    assert.deepEqual(urls, ['http://localhost:3001/home?fail=true']);
    assert.deepEqual(outcome, { kind: 'http', status: 500 });
  });

  it('data fixtures transform the validated payload and keep the plain URL', async () => {
    const urls: string[] = [];
    const outcome = await fetchHome({
      origin: ORIGIN,
      fixture: 'zero-banners',
      fetchImpl: async (url) => {
        urls.push(String(url));
        return jsonResponse(wirePayload());
      },
    });

    assert.deepEqual(urls, ['http://localhost:3001/home']);
    assert.equal(outcome.kind === 'ok' && outcome.data.banners.length, 0);
    assert.equal(outcome.kind === 'ok' && outcome.data.categories.length, 2);
  });

  it('a fixture never hides a real failure', async () => {
    const outcome = await fetchHome({
      origin: ORIGIN,
      fixture: 'all-empty',
      fetchImpl: async () => {
        throw new TypeError('Network request failed');
      },
    });

    assert.deepEqual(outcome, { kind: 'network' });
  });
});


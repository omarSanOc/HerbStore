/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fetchJson } from './http.ts';

type FetchImpl = NonNullable<Parameters<typeof fetchJson>[1]['fetchImpl']>;

function parseName(payload: unknown): string | undefined {
  if (typeof payload === 'object' && payload !== null && 'name' in payload) {
    const { name } = payload;
    return typeof name === 'string' ? name : undefined;
  }
  return undefined;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** A fetch that never resolves by itself and rejects with AbortError when aborted. */
const hangingFetch: FetchImpl = (_url, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => {
      reject(new DOMException('The operation was aborted.', 'AbortError'));
    });
  });

describe('fetchJson', () => {
  it('returns ok with the parsed payload', async () => {
    const outcome = await fetchJson('http://x.test/a', {
      parse: parseName,
      fetchImpl: async () => jsonResponse({ name: 'Vitamin C' }),
    });

    assert.deepEqual(outcome, { kind: 'ok', data: 'Vitamin C', status: 200 });
  });

  it('returns http for any non-2xx response, keeping the status', async () => {
    const notFound = await fetchJson('http://x.test/a', {
      parse: parseName,
      fetchImpl: async () => jsonResponse({ error: { code: 'PRODUCT_NOT_FOUND' } }, 404),
    });
    const serverError = await fetchJson('http://x.test/a', {
      parse: parseName,
      fetchImpl: async () => jsonResponse({ error: { code: 'SIMULATED_FAILURE' } }, 500),
    });

    assert.deepEqual(notFound, { kind: 'http', status: 404 });
    assert.deepEqual(serverError, { kind: 'http', status: 500 });
  });

  it('returns network when fetch rejects with TypeError (no response)', async () => {
    const outcome = await fetchJson('http://x.test/a', {
      parse: parseName,
      fetchImpl: async () => {
        throw new TypeError('Network request failed');
      },
    });

    assert.deepEqual(outcome, { kind: 'network' });
  });

  it('returns network when fetch rejects with expo/fetch FetchError (an Error, not a TypeError)', async () => {
    // Mirror of node_modules/expo/src/winter/fetch/FetchErrors.ts: SDK 57 installs expo/fetch as
    // the global fetch, and its native failures are `FetchError extends Error`.
    class FetchError extends Error {
      constructor(message: string) {
        super(`fetch failed: ${message}`);
      }
    }
    const failure = new FetchError('Failed to connect to /127.0.0.1:3001');
    assert.equal(failure instanceof TypeError, false);

    const outcome = await fetchJson('http://x.test/a', {
      parse: parseName,
      fetchImpl: async () => {
        throw failure;
      },
    });

    assert.deepEqual(outcome, { kind: 'network' });
  });

  it('classifies by structure (no response), not by error type: any non-abort fetch rejection is network', async () => {
    for (const thrown of [new Error('boom'), 'string rejection', { code: 'ECONNREFUSED' }, null]) {
      const outcome = await fetchJson('http://x.test/a', {
        parse: parseName,
        fetchImpl: async () => {
          throw thrown;
        },
      });

      assert.deepEqual(outcome, { kind: 'network' });
    }
  });

  it('keeps timeout and aborted ahead of network when fetch rejects with an Error after our abort', async () => {
    // expo/fetch rejects with a FetchError when its signal fires; that must not read as offline.
    const abortedFetch: FetchImpl = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new Error('fetch failed: The operation was aborted.'));
        });
      });

    const timedOut = await fetchJson('http://x.test/a', {
      parse: parseName,
      fetchImpl: abortedFetch,
      timeoutMs: 20,
    });

    const controller = new AbortController();
    const pending = fetchJson('http://x.test/a', {
      parse: parseName,
      fetchImpl: abortedFetch,
      signal: controller.signal,
      timeoutMs: 5_000,
    });
    controller.abort();

    assert.deepEqual(timedOut, { kind: 'timeout' });
    assert.deepEqual(await pending, { kind: 'aborted' });
  });

  it('a failure while reading the body of a 2xx response is invalid, not network', async () => {
    class FetchError extends Error {}
    const unreadable = {
      ok: true,
      status: 200,
      json: async () => {
        throw new FetchError('fetch failed: connection reset while reading the body');
      },
    } as unknown as Response;

    const outcome = await fetchJson('http://x.test/a', {
      parse: parseName,
      fetchImpl: async () => unreadable,
    });

    assert.deepEqual(outcome, { kind: 'invalid' });
  });

  it('returns invalid when the body is not JSON or fails validation', async () => {
    const notJson = await fetchJson('http://x.test/a', {
      parse: parseName,
      fetchImpl: async () => new Response('<html></html>', { status: 200 }),
    });
    const wrongShape = await fetchJson('http://x.test/a', {
      parse: parseName,
      fetchImpl: async () => jsonResponse({ unexpected: true }),
    });

    assert.deepEqual(notJson, { kind: 'invalid' });
    assert.deepEqual(wrongShape, { kind: 'invalid' });
  });

  it('returns timeout when the server does not answer in time', async () => {
    const outcome = await fetchJson('http://x.test/a', {
      parse: parseName,
      fetchImpl: hangingFetch,
      timeoutMs: 20,
    });

    assert.deepEqual(outcome, { kind: 'timeout' });
  });

  it('returns aborted when the caller cancels, and never reports a timeout', async () => {
    const controller = new AbortController();
    const pending = fetchJson('http://x.test/a', {
      parse: parseName,
      fetchImpl: hangingFetch,
      signal: controller.signal,
      timeoutMs: 5_000,
    });
    controller.abort();

    assert.deepEqual(await pending, { kind: 'aborted' });
  });

  it('does not call fetch when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    let calls = 0;

    const outcome = await fetchJson('http://x.test/a', {
      parse: parseName,
      signal: controller.signal,
      fetchImpl: async () => {
        calls += 1;
        return jsonResponse({ name: 'x' });
      },
    });

    assert.deepEqual(outcome, { kind: 'aborted' });
    assert.equal(calls, 0);
  });

  it('aborting after the response has arrived is a no-op', async () => {
    const controller = new AbortController();
    const outcome = await fetchJson('http://x.test/a', {
      parse: parseName,
      signal: controller.signal,
      fetchImpl: async () => jsonResponse({ name: 'ok' }),
    });
    controller.abort();

    assert.equal(outcome.kind, 'ok');
  });
});

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

  describe('requests with a method, body and headers', () => {
    type Captured = { url: string; init: RequestInit | undefined };

    function capturingFetch(captured: Captured[], response: () => Response): FetchImpl {
      return async (url, init) => {
        captured.push({ url, init });
        return response();
      };
    }

    it('defaults to GET with no body and no Content-Type', async () => {
      const captured: Captured[] = [];

      await fetchJson('http://x.test/a', {
        parse: parseName,
        fetchImpl: capturingFetch(captured, () => jsonResponse({ name: 'x' })),
      });

      const init = captured[0]?.init;
      assert.equal(init?.method, 'GET');
      assert.equal(init?.body, undefined);
      assert.deepEqual(init?.headers, { Accept: 'application/json' });
    });

    it('POST serializes the body as JSON and adds Content-Type only because there is a body', async () => {
      const captured: Captured[] = [];

      const outcome = await fetchJson('http://x.test/orders', {
        method: 'POST',
        body: { items: [{ productId: 'p1', quantity: 2 }], currency: 'MXN' },
        headers: { 'Idempotency-Key': 'key-1' },
        parse: parseName,
        fetchImpl: capturingFetch(captured, () => jsonResponse({ name: 'order' }, 200)),
      });

      const init = captured[0]?.init;
      assert.deepEqual(outcome, { kind: 'ok', data: 'order', status: 200 });
      assert.equal(captured[0]?.url, 'http://x.test/orders');
      assert.equal(init?.method, 'POST');
      assert.equal(init?.body, '{"items":[{"productId":"p1","quantity":2}],"currency":"MXN"}');
      assert.deepEqual(init?.headers, {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Idempotency-Key': 'key-1',
      });
    });

    it('a body that is falsy but defined is still sent', async () => {
      const captured: Captured[] = [];

      await fetchJson('http://x.test/a', {
        method: 'POST',
        body: 0,
        parse: parseName,
        fetchImpl: capturingFetch(captured, () => jsonResponse({ name: 'x' })),
      });

      assert.equal(captured[0]?.init?.body, '0');
    });

    it('treats a 202 as ok, keeping the status (the order protocol relies on it)', async () => {
      const outcome = await fetchJson('http://x.test/orders', {
        method: 'POST',
        body: {},
        parse: parseName,
        fetchImpl: async () => jsonResponse({ name: 'pending' }, 202),
      });

      assert.deepEqual(outcome, { kind: 'ok', data: 'pending', status: 202 });
    });

    it('keeps the same classification for POST: network, http, timeout and aborted', async () => {
      class FetchError extends Error {}
      const network = await fetchJson('http://x.test/orders', {
        method: 'POST',
        body: {},
        parse: parseName,
        fetchImpl: async () => {
          throw new FetchError('fetch failed: Failed to connect');
        },
      });
      const conflict = await fetchJson('http://x.test/orders', {
        method: 'POST',
        body: {},
        parse: parseName,
        fetchImpl: async () => jsonResponse({ error: { code: 'IDEMPOTENCY_CONFLICT' } }, 409),
      });
      const timeout = await fetchJson('http://x.test/orders', {
        method: 'POST',
        body: {},
        parse: parseName,
        fetchImpl: hangingFetch,
        timeoutMs: 20,
      });
      const controller = new AbortController();
      controller.abort();
      const aborted = await fetchJson('http://x.test/orders', {
        method: 'POST',
        body: {},
        parse: parseName,
        signal: controller.signal,
        fetchImpl: hangingFetch,
      });

      assert.deepEqual(network, { kind: 'network' });
      assert.deepEqual(conflict, { kind: 'http', status: 409 });
      assert.deepEqual(timeout, { kind: 'timeout' });
      assert.deepEqual(aborted, { kind: 'aborted' });
    });
  });

  // M-5 (T2). The response head arrives, then the body stalls or breaks. The request timer and the
  // caller's signal must still decide the outcome, because real runtimes reject the body read with
  // whatever error they like (expo/fetch: `FetchError extends Error`; Hermes polyfill: `TypeError`).
  // Android/OkHttp: `SocketTimeoutException` while reading the body; iOS: `URLError.timedOut`
  // from `URLSession` after the headers. Time is controlled (`mock.timers`): no real waiting.
  describe('cancellation while reading the body (M-5)', () => {
    class FetchError extends Error {}

    /** A response whose head is fine and whose body only ends when the request is aborted. */
    function stalledBody(status: number, rejectWith: () => unknown, reads: { count: number }): FetchImpl {
      return async (_url, init) =>
        ({
          ok: status >= 200 && status < 300,
          status,
          json: () => {
            reads.count += 1;
            return new Promise((_resolve, reject) => {
              init?.signal?.addEventListener('abort', () => reject(rejectWith()));
            });
          },
        }) as unknown as Response;
    }

    // Different ways a runtime may reject an aborted body read. None of them may read as `network`.
    const rejections: readonly (readonly [string, () => unknown])[] = [
      ['AbortError', () => new DOMException('The operation was aborted.', 'AbortError')],
      ['expo/fetch FetchError', () => new FetchError('fetch failed: request aborted')],
      ['TypeError', () => new TypeError('Network request failed')],
      ['a string', () => 'aborted'],
    ];

    // Lets the awaited `fetchImpl` and the `json()` call run before the clock moves.
    const settleMicrotasks = () => new Promise<void>((resolve) => setImmediate(resolve));

    for (const [label, rejectWith] of rejections) {
      it(`2xx: a body that stalls until the timeout is timeout, not invalid or network (${label})`, async (t) => {
        t.mock.timers.enable({ apis: ['setTimeout'] });
        const reads = { count: 0 };
        const pending = fetchJson('http://x.test/a', {
          parse: parseName,
          fetchImpl: stalledBody(200, rejectWith, reads),
          timeoutMs: 8_000,
        });

        await settleMicrotasks();
        t.mock.timers.tick(7_999);
        await settleMicrotasks();
        assert.equal(reads.count, 1, 'the body is being read and has not been given up yet');

        t.mock.timers.tick(1);
        assert.deepEqual(await pending, { kind: 'timeout' });
      });

      it(`2xx: the caller's own abort during the body read is aborted, never timeout or network (${label})`, async (t) => {
        t.mock.timers.enable({ apis: ['setTimeout'] });
        const controller = new AbortController();
        const reads = { count: 0 };
        const pending = fetchJson('http://x.test/a', {
          parse: parseName,
          fetchImpl: stalledBody(200, rejectWith, reads),
          signal: controller.signal,
          timeoutMs: 8_000,
        });

        await settleMicrotasks();
        controller.abort();

        assert.deepEqual(await pending, { kind: 'aborted' });
      });
    }

    it('2xx: a body that fails with no cancellation involved stays invalid (the answer is unusable)', async () => {
      const reads = { count: 0 };
      const broken: FetchImpl = async () =>
        ({
          ok: true,
          status: 200,
          json: () => {
            reads.count += 1;
            return Promise.reject(new FetchError('fetch failed: connection reset'));
          },
        }) as unknown as Response;

      assert.deepEqual(await fetchJson('http://x.test/a', { parse: parseName, fetchImpl: broken }), { kind: 'invalid' });
      assert.equal(reads.count, 1);
    });

    describe('non-2xx with parseErrorBody (the order protocol reads 4xx bodies)', () => {
      const parseErrorBody = (status: number, payload: unknown) => ({ status, payload });

      for (const [label, rejectWith] of rejections) {
        it(`a stalled error body that hits the timeout is timeout, like on a 2xx (${label})`, async (t) => {
          t.mock.timers.enable({ apis: ['setTimeout'] });
          const reads = { count: 0 };
          const pending = fetchJson('http://x.test/orders', {
            parse: parseName,
            parseErrorBody,
            fetchImpl: stalledBody(503, rejectWith, reads),
            timeoutMs: 8_000,
          });

          await settleMicrotasks();
          t.mock.timers.tick(8_000);

          assert.deepEqual(await pending, { kind: 'timeout' });
          assert.equal(reads.count, 1);
        });

        it(`a stalled error body cancelled by the caller is aborted (${label})`, async (t) => {
          t.mock.timers.enable({ apis: ['setTimeout'] });
          const controller = new AbortController();
          const reads = { count: 0 };
          const pending = fetchJson('http://x.test/orders', {
            parse: parseName,
            parseErrorBody,
            fetchImpl: stalledBody(409, rejectWith, reads),
            signal: controller.signal,
            timeoutMs: 8_000,
          });

          await settleMicrotasks();
          controller.abort();

          assert.deepEqual(await pending, { kind: 'aborted' });
        });
      }

      it('without parseErrorBody the body is never read, so a stalled one cannot delay the status', async () => {
        const reads = { count: 0 };
        const outcome = await fetchJson('http://x.test/a', {
          parse: parseName,
          fetchImpl: stalledBody(503, () => new Error('never'), reads),
          timeoutMs: 8_000,
        });

        assert.deepEqual(outcome, { kind: 'http', status: 503 });
        assert.equal(reads.count, 0);
      });

      it('a readable error body is attached; an unreadable one (no cancellation) keeps only the status', async () => {
        const readable = await fetchJson('http://x.test/orders', {
          parse: parseName,
          parseErrorBody,
          fetchImpl: async () => jsonResponse({ error: { code: 'OUT_OF_STOCK' } }, 409),
        });
        const notJson = await fetchJson('http://x.test/orders', {
          parse: parseName,
          parseErrorBody,
          fetchImpl: async () => new Response('<html>bad gateway</html>', { status: 502 }),
        });
        const parserThrows = await fetchJson('http://x.test/orders', {
          parse: parseName,
          parseErrorBody: () => {
            throw new Error('parser bug');
          },
          fetchImpl: async () => jsonResponse({}, 500),
        });
        const parserDeclines = await fetchJson('http://x.test/orders', {
          parse: parseName,
          parseErrorBody: () => undefined,
          fetchImpl: async () => jsonResponse({}, 404),
        });

        assert.deepEqual(readable, {
          kind: 'http',
          status: 409,
          body: { status: 409, payload: { error: { code: 'OUT_OF_STOCK' } } },
        });
        assert.deepEqual(notJson, { kind: 'http', status: 502 });
        assert.deepEqual(parserThrows, { kind: 'http', status: 500 });
        assert.deepEqual(parserDeclines, { kind: 'http', status: 404 });
      });
    });
  });
});

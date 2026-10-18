/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createFetchJsonBaseQuery } from '../../../core/api/fetch-json-base-query.ts';
import { wirePayload } from '../testing/home-test-data.ts';
import { applyHomeFixture } from './home-fixtures.ts';
import { buildHomeRequest } from './home-request.ts';

type FetchImpl = NonNullable<Parameters<typeof createFetchJsonBaseQuery>[0]['fetchImpl']>;

const ORIGIN = 'http://localhost:3001';

// `expo/fetch` rejects with a `FetchError extends Error`, never with a `TypeError`.
class FetchError extends Error {}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
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
  it('requests GET /home, without a query string, when there is no fixture', () => {
    assert.equal(buildHomeRequest(undefined).path, '/home');
  });

  it('reaches the given origin with GET /home', async () => {
    const urls: string[] = [];

    await run(buildHomeRequest(undefined), async (url) => {
      urls.push(String(url));
      return jsonResponse(wirePayload());
    });

    assert.deepEqual(urls, ['http://localhost:3001/home']);
  });

  it('parse validates a server payload into HomeData', () => {
    const data = buildHomeRequest(undefined).parse(wirePayload());

    assert.equal(data?.banners.length, 2);
    assert.equal(data?.categories.length, 2);
    assert.equal(data?.sections.length, 3);
  });

  it('parse gives undefined for a payload that breaks the contract', () => {
    assert.equal(buildHomeRequest(undefined).parse({ banners: 'nope' }), undefined);
    assert.equal(buildHomeRequest(undefined).parse(null), undefined);
  });

  it('a malformed element invalidates the whole payload', () => {
    const payload = wirePayload();
    const sections = payload.sections as { items: Record<string, unknown>[] }[];
    sections[0]!.items[0]!.price = 'free';

    assert.equal(buildHomeRequest(undefined).parse(payload), undefined);
  });
});

describe('buildHomeRequest outcomes through the base query', () => {
  it('maps ok, network (FetchError), 500 and an unusable body like Day 2', async () => {
    const request = buildHomeRequest(undefined);

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

    const pending = run(buildHomeRequest(undefined), hangingFetch, controller.signal);
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
    const pending = run(buildHomeRequest(undefined), hangingFetch).then((result) => {
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

describe('buildHomeRequest fixtures', () => {
  it('server-fail asks the real server for its simulated failure', async () => {
    const urls: string[] = [];
    const request = buildHomeRequest('server-fail', applyHomeFixture);
    const result = await run(request, async (url) => {
      urls.push(String(url));
      return jsonResponse({ error: { code: 'SIMULATED_FAILURE', message: 'x' } }, 500);
    });

    assert.equal(request.path, '/home?fail=true');
    assert.deepEqual(urls, ['http://localhost:3001/home?fail=true']);
    assert.deepEqual(result.error, { kind: 'http', status: 500 });
  });

  it('data fixtures transform the validated payload and keep the plain path', async () => {
    const urls: string[] = [];
    const request = buildHomeRequest('zero-banners', applyHomeFixture);
    const result = await run(request, async (url) => {
      urls.push(String(url));
      return jsonResponse(wirePayload());
    });
    const data = result.data as { banners: unknown[]; categories: unknown[] };

    assert.deepEqual(urls, ['http://localhost:3001/home']);
    assert.equal(data.banners.length, 0);
    assert.equal(data.categories.length, 2);
  });

  it('every data fixture keeps working on a valid payload', () => {
    const empty = buildHomeRequest('all-empty', applyHomeFixture).parse(wirePayload());
    const oneBanner = buildHomeRequest('one-banner', applyHomeFixture).parse(wirePayload());
    const emptySection = buildHomeRequest('empty-section', applyHomeFixture).parse(wirePayload());
    const broken = buildHomeRequest('broken-image', applyHomeFixture).parse(wirePayload());

    assert.deepEqual(empty, { banners: [], categories: [], sections: [] });
    assert.equal(oneBanner?.banners.length, 1);
    assert.equal(emptySection?.sections.find(({ id }) => id === 'new')?.items.length, 0);
    assert.equal(broken?.banners[0]?.imageUrl, '/images/missing/broken.png');
  });

  it('a fixture never hides a real failure', async () => {
    const network = await run(buildHomeRequest('all-empty', applyHomeFixture), async () => {
      throw new FetchError('Network request failed');
    });
    const invalid = await run(buildHomeRequest('all-empty', applyHomeFixture), async () => jsonResponse({ banners: 1 }));

    assert.deepEqual(network.error, { kind: 'network' });
    assert.deepEqual(invalid.error, { kind: 'invalid' });
  });

  it('does not transform the payload when no fixture module is supplied (release builds)', () => {
    const plain = buildHomeRequest('zero-banners').parse(wirePayload());

    assert.equal(plain?.banners.length, 2);
    assert.equal(buildHomeRequest('server-fail').path, '/home?fail=true');
  });
});

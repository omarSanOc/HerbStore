/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fetchProductLookup } from './product-client.ts';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('fetchProductLookup', () => {
  it('requests GET /products/:id on the given origin', async () => {
    const urls: string[] = [];

    await fetchProductLookup({
      origin: 'http://localhost:3001',
      id: 'product-261009-001',
      fetchImpl: async (url) => {
        urls.push(String(url));
        return jsonResponse({ id: 'product-261009-001', name: 'Vitamin C 1000' });
      },
    });

    assert.deepEqual(urls, ['http://localhost:3001/products/product-261009-001']);
  });

  it('maps a product payload to found with only id and name', async () => {
    const lookup = await fetchProductLookup({
      origin: 'http://localhost:3001',
      id: 'product-261009-001',
      fetchImpl: async () =>
        jsonResponse({ id: 'product-261009-001', name: 'Vitamin C 1000', price: 10 }),
    });

    assert.deepEqual(lookup, {
      status: 'found',
      product: { id: 'product-261009-001', name: 'Vitamin C 1000' },
    });
  });

  it('maps HTTP 404 to not-found', async () => {
    const lookup = await fetchProductLookup({
      origin: 'http://localhost:3001',
      id: 'product-261009-999',
      fetchImpl: async () =>
        jsonResponse({ error: { code: 'PRODUCT_NOT_FOUND', message: 'nope' } }, 404),
    });

    assert.deepEqual(lookup, { status: 'not-found' });
  });

  it('maps other HTTP errors, a timeout and an unusable payload to error', async () => {
    const serverError = await fetchProductLookup({
      origin: 'http://localhost:3001',
      id: 'product-261009-001',
      fetchImpl: async () => jsonResponse({ error: { code: 'SIMULATED_FAILURE' } }, 500),
    });
    const invalid = await fetchProductLookup({
      origin: 'http://localhost:3001',
      id: 'product-261009-001',
      fetchImpl: async () => jsonResponse({ id: 'product-261009-001' }),
    });
    const timeout = await fetchProductLookup({
      origin: 'http://localhost:3001',
      id: 'product-261009-001',
      timeoutMs: 10,
      fetchImpl: (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        }),
    });

    assert.deepEqual(serverError, { status: 'error' });
    assert.deepEqual(invalid, { status: 'error' });
    assert.deepEqual(timeout, { status: 'error' });
  });

  it('maps a rejected fetch (TypeError) to offline, distinct from error', async () => {
    const lookup = await fetchProductLookup({
      origin: 'http://localhost:3001',
      id: 'product-261009-001',
      fetchImpl: async () => {
        throw new TypeError('Network request failed');
      },
    });

    assert.deepEqual(lookup, { status: 'offline' });
  });

  it('reports aborted so the caller can drop stale answers', async () => {
    const controller = new AbortController();
    controller.abort();

    const lookup = await fetchProductLookup({
      origin: 'http://localhost:3001',
      id: 'product-261009-001',
      signal: controller.signal,
      fetchImpl: async () => jsonResponse({ id: 'product-261009-001', name: 'x' }),
    });

    assert.deepEqual(lookup, { status: 'aborted' });
  });
});

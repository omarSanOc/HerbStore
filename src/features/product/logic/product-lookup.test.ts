/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ApiError } from '../../../core/api/api-error.ts';
import type { CatalogProduct } from '../contracts/catalog-product.ts';
import { classifyProductLookup, type ProductLookupSnapshot } from './product-lookup.ts';

const product: CatalogProduct = {
  id: 'product-261009-001',
  brand: 'AsterVale Nutrition',
  name: 'Complete Daily Powder',
  categoryId: 'vitamins',
  subcategoryId: 'multivitamins',
  price: 12.99,
  currency: 'USD',
  rating: 4.2,
  reviewCount: 10,
  soldLast30Days: 5,
  badges: [],
  inStock: true,
  images: [],
};

/*
 * A snapshot is what `useGetProductQuery` gives: `data` is the last successful payload (kept
 * through a failure), `error` is the failure of the latest settled request (RTK keeps it through
 * the next pending request and clears it on success) and `isFetching` is true while in flight.
 */
const settled = (data: CatalogProduct | undefined, error?: ApiError): ProductLookupSnapshot => ({
  data,
  error,
  isFetching: false,
});
const fetching = (data: CatalogProduct | undefined, error?: ApiError): ProductLookupSnapshot => ({
  data,
  error,
  isFetching: true,
});

const NETWORK: ApiError = { kind: 'network' };
const NOT_FOUND: ApiError = { kind: 'http', status: 404 };

describe('classifyProductLookup: answers', () => {
  it('is found when the product arrived', () => {
    assert.deepEqual(classifyProductLookup(settled(product)), { status: 'found', product });
  });

  it('is not-found for an HTTP 404', () => {
    assert.deepEqual(classifyProductLookup(settled(undefined, NOT_FOUND)), { status: 'not-found' });
  });

  it('is offline when fetch failed without any response', () => {
    assert.deepEqual(classifyProductLookup(settled(undefined, NETWORK)), { status: 'offline' });
  });

  it('is error for 5xx, a timeout and an invalid payload, never offline or not-found', () => {
    for (const error of [
      { kind: 'http', status: 500 },
      { kind: 'http', status: 503 },
      { kind: 'timeout' },
      { kind: 'invalid' },
    ] satisfies ApiError[]) {
      assert.deepEqual(classifyProductLookup(settled(undefined, error)), { status: 'error' });
    }
  });

  it('treats other 4xx like any server answer that is not a 404: error', () => {
    assert.deepEqual(classifyProductLookup(settled(undefined, { kind: 'http', status: 400 })), {
      status: 'error',
    });
  });
});

describe('classifyProductLookup: waiting', () => {
  it('is loading while the first request is in flight', () => {
    assert.deepEqual(classifyProductLookup(fetching(undefined)), { status: 'loading' });
  });

  it('is loading when nothing is known yet (no data, no error, nothing in flight)', () => {
    assert.deepEqual(classifyProductLookup(settled(undefined)), { status: 'loading' });
  });

  it('shows loading, not the old failure, while a retry without data is in flight', () => {
    // RTK keeps `error` through `pending`: the manual retry must show the spinner again.
    assert.deepEqual(classifyProductLookup(fetching(undefined, NETWORK)), { status: 'loading' });
    assert.deepEqual(classifyProductLookup(fetching(undefined, NOT_FOUND)), { status: 'loading' });
  });

  it('treats an aborted request as a cancellation, not as a failure', () => {
    assert.deepEqual(classifyProductLookup(settled(undefined, { kind: 'aborted' })), {
      status: 'loading',
    });
    assert.deepEqual(classifyProductLookup(settled(product, { kind: 'aborted' })), {
      status: 'found',
      product,
    });
  });
});

describe('classifyProductLookup: data already known', () => {
  it('keeps showing the product while it is revalidated', () => {
    assert.deepEqual(classifyProductLookup(fetching(product)), { status: 'found', product });
  });

  it('keeps the product when a revalidation fails for network, 5xx, timeout or invalid', () => {
    for (const error of [
      NETWORK,
      { kind: 'http', status: 503 },
      { kind: 'timeout' },
      { kind: 'invalid' },
    ] satisfies ApiError[]) {
      assert.deepEqual(classifyProductLookup(settled(product, error)), { status: 'found', product });
      assert.deepEqual(classifyProductLookup(fetching(product, error)), { status: 'found', product });
    }
  });

  it('is not-found when a revalidation says the product no longer exists', () => {
    assert.deepEqual(classifyProductLookup(settled(product, NOT_FOUND)), { status: 'not-found' });
    assert.deepEqual(classifyProductLookup(fetching(product, NOT_FOUND)), { status: 'not-found' });
  });
});

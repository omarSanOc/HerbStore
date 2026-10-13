/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ApiError } from '../../../core/api/api-error.ts';
import type { CatalogProduct, ProductPage } from '../contracts/catalog-product.ts';
import {
  classifyProductListState,
  type ProductListSnapshot,
  type ProductListState,
} from './product-list-state.ts';

function product(id: string): CatalogProduct {
  return {
    id,
    brand: 'AsterVale Nutrition',
    name: `Product ${id}`,
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
}

function page(ids: readonly string[], pageNumber: number, totalPages: number, total: number): ProductPage {
  return { items: ids.map(product), page: pageNumber, totalPages, total };
}

const firstPage = page(['a', 'b'], 1, 2, 4);
const twoPages = [firstPage, page(['c', 'd'], 2, 2, 4)];
const noMatches = [page([], 1, 0, 0)];

const NETWORK: ApiError = { kind: 'network' };
const SERVER: ApiError = { kind: 'http', status: 503 };
const TIMEOUT: ApiError = { kind: 'timeout' };
const INVALID: ApiError = { kind: 'invalid' };
const ABORTED: ApiError = { kind: 'aborted' };

/*
 * A snapshot is what the infinite-query hook gives (reading `currentData`, never `data`): the
 * pages of the CURRENT args, the failure of the latest settled request (RTK keeps it through the
 * next pending request and clears it on success) and the direction flags.
 */
function snapshot(overrides: Partial<ProductListSnapshot> = {}): ProductListSnapshot {
  return {
    currentData: undefined,
    error: undefined,
    isFetching: false,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
    ...overrides,
  };
}

const withPages = (pages: readonly ProductPage[], overrides: Partial<ProductListSnapshot> = {}) =>
  snapshot({ currentData: { pages }, ...overrides });

function ready(state: ProductListState) {
  assert.equal(state.status, 'ready');
  if (state.status !== 'ready') {
    throw new Error('unreachable');
  }

  return state;
}

describe('classifyProductListState: first page', () => {
  it('is loading on the first load', () => {
    assert.deepEqual(classifyProductListState(snapshot({ isFetching: true })), { status: 'loading' });
  });

  it('is loading before the request has even started', () => {
    assert.deepEqual(classifyProductListState(snapshot()), { status: 'loading' });
  });

  it('is loading for new params that have no currentData yet', () => {
    // The hook keeps `data` of the previous params, but `currentData` is undefined for the new ones.
    assert.deepEqual(classifyProductListState(snapshot({ currentData: undefined, isFetching: true })), {
      status: 'loading',
    });
  });

  it('is loading, not a failure screen, while retrying with a failure still remembered', () => {
    assert.deepEqual(classifyProductListState(snapshot({ error: NETWORK, isFetching: true })), {
      status: 'loading',
    });
    assert.deepEqual(classifyProductListState(snapshot({ error: SERVER, isFetching: true })), {
      status: 'loading',
    });
  });

  it('treats an aborted request as a cancellation, not a failure', () => {
    assert.deepEqual(classifyProductListState(snapshot({ error: ABORTED })), { status: 'loading' });
  });
});

describe('classifyProductListState: ready', () => {
  it('lists the flattened, unique products with the latest total', () => {
    const state = ready(classifyProductListState(withPages(twoPages)));

    assert.deepEqual(
      state.products.map(({ id }) => id),
      ['a', 'b', 'c', 'd'],
    );
    assert.equal(state.total, 4);
    assert.equal(state.footer, 'idle');
    assert.equal(state.notice, undefined);
  });

  it('shows a single card for an id that arrives in two pages', () => {
    const state = ready(
      classifyProductListState(
        withPages([firstPage, page(['b', 'c'], 2, 2, 3)]),
      ),
    );

    assert.deepEqual(
      state.products.map(({ id }) => id),
      ['a', 'b', 'c'],
    );
  });

  it('keeps the products and shows a loading footer while the next page loads', () => {
    const state = ready(
      classifyProductListState(withPages([firstPage], { isFetching: true, isFetchingNextPage: true })),
    );

    assert.equal(state.products.length, 2);
    assert.equal(state.footer, 'loading-more');
    assert.equal(state.notice, undefined);
  });

  it('keeps the products and shows an error footer when the next page fails', () => {
    for (const error of [NETWORK, SERVER, TIMEOUT, INVALID]) {
      const state = ready(
        classifyProductListState(withPages([firstPage], { error, isFetchNextPageError: true })),
      );

      assert.equal(state.products.length, 2);
      assert.equal(state.footer, 'load-more-failed');
      assert.equal(state.notice, undefined);
    }
  });

  it('goes back to the loading footer when the user retries the failed next page', () => {
    // RTK keeps `error` while the retry is pending; the pending request is a forward fetch again.
    const state = ready(
      classifyProductListState(
        withPages([firstPage], { error: SERVER, isFetching: true, isFetchingNextPage: true }),
      ),
    );

    assert.equal(state.footer, 'loading-more');
    assert.equal(state.notice, undefined);
  });

  it('does not show a failure footer for a cancelled next page', () => {
    const state = ready(
      classifyProductListState(withPages([firstPage], { error: ABORTED, isFetchNextPageError: true })),
    );

    assert.equal(state.footer, 'idle');
    assert.equal(state.notice, undefined);
  });

  it('keeps the list during a refresh, with no footer and no notice', () => {
    const state = ready(classifyProductListState(withPages(twoPages, { isFetching: true })));

    assert.deepEqual(
      state.products.map(({ id }) => id),
      ['a', 'b', 'c', 'd'],
    );
    assert.equal(state.footer, 'idle');
    assert.equal(state.notice, undefined);
  });
});

describe('classifyProductListState: failures', () => {
  it('network without data is offline', () => {
    assert.deepEqual(classifyProductListState(snapshot({ error: NETWORK })), { status: 'offline' });
  });

  it('5xx, timeout and invalid payloads without data are errors, never offline', () => {
    for (const error of [SERVER, TIMEOUT, INVALID]) {
      assert.deepEqual(classifyProductListState(snapshot({ error })), { status: 'error' });
    }
  });

  it('a failed refresh keeps the list with an offline notice for network', () => {
    const state = ready(classifyProductListState(withPages(twoPages, { error: NETWORK })));

    assert.equal(state.products.length, 4);
    assert.equal(state.notice, 'offline');
    assert.equal(state.footer, 'idle');
  });

  it('a failed refresh keeps the list with an update-failed notice for 5xx, timeout and invalid', () => {
    for (const error of [SERVER, TIMEOUT, INVALID]) {
      const state = ready(classifyProductListState(withPages(twoPages, { error })));

      assert.equal(state.products.length, 4);
      assert.equal(state.notice, 'update-failed');
    }
  });

  it('keeps the notice while retrying over data, until a success clears the error', () => {
    const retrying = ready(
      classifyProductListState(withPages(twoPages, { error: NETWORK, isFetching: true })),
    );
    assert.equal(retrying.notice, 'offline');

    const recovered = ready(classifyProductListState(withPages(twoPages)));
    assert.equal(recovered.notice, undefined);
  });

  it('a cancelled refresh over data is not a failure', () => {
    const state = ready(classifyProductListState(withPages(twoPages, { error: ABORTED })));

    assert.equal(state.notice, undefined);
  });

  it('a failed next page does not add a stale-data notice on top of the footer', () => {
    const state = ready(
      classifyProductListState(withPages([firstPage], { error: NETWORK, isFetchNextPageError: true })),
    );

    assert.equal(state.footer, 'load-more-failed');
    assert.equal(state.notice, undefined);
  });
});

describe('classifyProductListState: empty', () => {
  it('is empty when the query has no matches', () => {
    assert.deepEqual(classifyProductListState(withPages(noMatches)), { status: 'empty' });
  });

  it('stays empty while an empty result is revalidated', () => {
    assert.deepEqual(classifyProductListState(withPages(noMatches, { isFetching: true })), {
      status: 'empty',
    });
  });

  it('is not empty when a later page is out of range and answers no items', () => {
    // The server answers `items: []` (not an error) beyond the last page; the products of the
    // earlier pages are the ones that count.
    const state = ready(
      classifyProductListState(withPages([firstPage, page([], 3, 2, 4)])),
    );

    assert.equal(state.products.length, 2);
  });

  it('a failed refresh over an empty result is the failure screen, as in Home', () => {
    assert.deepEqual(classifyProductListState(withPages(noMatches, { error: NETWORK })), {
      status: 'offline',
    });
    assert.deepEqual(classifyProductListState(withPages(noMatches, { error: SERVER })), {
      status: 'error',
    });
  });

  it('retrying a failed empty result shows loading again', () => {
    assert.deepEqual(
      classifyProductListState(withPages(noMatches, { error: SERVER, isFetching: true })),
      { status: 'loading' },
    );
  });
});

describe('classifyProductListState: purity', () => {
  it('does not mutate its input', () => {
    const input = Object.freeze(withPages(twoPages, { error: NETWORK }));

    assert.doesNotThrow(() => classifyProductListState(input));
  });
});

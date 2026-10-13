/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { CatalogProduct, ProductPage } from '../contracts/catalog-product.ts';
import {
  flattenUniqueProducts,
  getLastVisibleIndex,
  getNextPageParam,
  LOAD_MORE_THRESHOLD,
  shouldLoadNextPage,
} from './product-pages.ts';

function product(id: string, name = `Product ${id}`): CatalogProduct {
  return {
    id,
    brand: 'AsterVale Nutrition',
    name,
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

function page(
  ids: readonly string[],
  numbers: { page: number; totalPages: number; total: number },
): ProductPage {
  return { items: ids.map((id) => product(id)), ...numbers };
}

describe('getNextPageParam', () => {
  it('asks for the following page while there are more', () => {
    assert.equal(getNextPageParam({ page: 1, totalPages: 3 }), 2);
    assert.equal(getNextPageParam({ page: 2, totalPages: 3 }), 3);
  });

  it('stops on the last page', () => {
    assert.equal(getNextPageParam({ page: 3, totalPages: 3 }), undefined);
  });

  it('stops when there are no pages at all (no matches)', () => {
    assert.equal(getNextPageParam({ page: 1, totalPages: 0 }), undefined);
  });

  it('never goes past the last page even if the server answers an out-of-range one', () => {
    assert.equal(getNextPageParam({ page: 4, totalPages: 3 }), undefined);
  });

  it('accepts a whole ProductPage', () => {
    assert.equal(getNextPageParam(page(['a'], { page: 1, totalPages: 2, total: 21 })), 2);
  });
});

describe('flattenUniqueProducts', () => {
  it('keeps the order of the pages when there are no repeated ids', () => {
    const result = flattenUniqueProducts([
      page(['a', 'b'], { page: 1, totalPages: 2, total: 4 }),
      page(['c', 'd'], { page: 2, totalPages: 2, total: 4 }),
    ]);

    assert.deepEqual(
      result.items.map(({ id }) => id),
      ['a', 'b', 'c', 'd'],
    );
  });

  it('keeps the FIRST copy of a repeated id and its position', () => {
    const first = page(['a', 'b', 'c'], { page: 1, totalPages: 2, total: 5 });
    const second: ProductPage = {
      items: [product('c', 'Late copy of c'), product('d'), product('a', 'Late copy of a')],
      page: 2,
      totalPages: 2,
      total: 5,
    };

    const result = flattenUniqueProducts([first, second]);

    assert.deepEqual(
      result.items.map(({ id }) => id),
      ['a', 'b', 'c', 'd'],
    );
    assert.equal(result.items[0], first.items[0]);
    assert.equal(result.items[2]?.name, 'Product c');
  });

  it('adds only the ids that are not present yet across three pages', () => {
    const result = flattenUniqueProducts([
      page(['a', 'b'], { page: 1, totalPages: 3, total: 6 }),
      page(['b', 'c'], { page: 2, totalPages: 3, total: 6 }),
      page(['c', 'a', 'd'], { page: 3, totalPages: 3, total: 6 }),
    ]);

    assert.deepEqual(
      result.items.map(({ id }) => id),
      ['a', 'b', 'c', 'd'],
    );
  });

  it('takes page, totalPages and total from the most recent response', () => {
    const result = flattenUniqueProducts([
      page(['a'], { page: 1, totalPages: 2, total: 40 }),
      page(['b'], { page: 2, totalPages: 3, total: 41 }),
    ]);

    assert.equal(result.page, 2);
    assert.equal(result.totalPages, 3);
    assert.equal(result.total, 41);
  });

  it('reports "nothing loaded" for an empty list of pages', () => {
    assert.deepEqual(flattenUniqueProducts([]), { items: [], page: 0, totalPages: 0, total: 0 });
  });

  it('keeps a page without matches as an empty list with its own total', () => {
    const result = flattenUniqueProducts([page([], { page: 1, totalPages: 0, total: 0 })]);

    assert.deepEqual(result, { items: [], page: 1, totalPages: 0, total: 0 });
  });

  it('does not mutate its input', () => {
    const pages = Object.freeze([
      Object.freeze(page(['a'], { page: 1, totalPages: 2, total: 2 })),
      Object.freeze(page(['a', 'b'], { page: 2, totalPages: 2, total: 2 })),
    ]);

    assert.doesNotThrow(() => flattenUniqueProducts(pages));
    assert.equal(pages[1]?.items.length, 2);
  });
});

describe('getLastVisibleIndex', () => {
  it('is the highest index among the visible items', () => {
    assert.equal(getLastVisibleIndex([{ index: 3 }, { index: 7 }, { index: 5 }]), 7);
  });

  it('skips tokens without an index (null) instead of letting them poison the maximum', () => {
    assert.equal(getLastVisibleIndex([{ index: null }, { index: 4 }, { index: null }]), 4);
  });

  it('reports -1 when nothing is visible or no token has an index', () => {
    assert.equal(getLastVisibleIndex([]), -1);
    assert.equal(getLastVisibleIndex([{ index: null }]), -1);
  });

  it('does not depend on the order of the tokens', () => {
    assert.equal(getLastVisibleIndex([{ index: 9 }, { index: 2 }]), 9);
    assert.equal(getLastVisibleIndex([{ index: 2 }, { index: 9 }]), 9);
  });
});

describe('shouldLoadNextPage', () => {
  // One page of 20 loaded and nothing requested yet.
  const base = {
    itemCount: 20,
    pageCount: 1,
    hasNextPage: true,
    isFetching: false,
    requestedForCount: undefined,
  } as const;

  it('uses the last four items as the threshold', () => {
    assert.equal(LOAD_MORE_THRESHOLD, 4);
  });

  it('does not load while the user is still far from the end (index 15 of 20)', () => {
    assert.equal(shouldLoadNextPage({ ...base, lastVisibleIndex: 15 }), false);
    assert.equal(shouldLoadNextPage({ ...base, lastVisibleIndex: 0 }), false);
  });

  it('loads when any of the last four items is visible (index 16 of 20 and beyond)', () => {
    for (const lastVisibleIndex of [16, 17, 18, 19]) {
      assert.equal(shouldLoadNextPage({ ...base, lastVisibleIndex }), true);
    }
  });

  it('does not load a second time for the same number of loaded pages', () => {
    assert.equal(shouldLoadNextPage({ ...base, lastVisibleIndex: 17, requestedForCount: 1 }), false);
  });

  it('loads again once a page has landed', () => {
    const grown = { itemCount: 40, pageCount: 2, hasNextPage: true, isFetching: false } as const;
    assert.equal(shouldLoadNextPage({ ...grown, lastVisibleIndex: 36, requestedForCount: 1 }), true);
    assert.equal(shouldLoadNextPage({ ...grown, lastVisibleIndex: 35, requestedForCount: 1 }), false);
  });

  it('does not load without a next page (last page)', () => {
    assert.equal(shouldLoadNextPage({ ...base, lastVisibleIndex: 19, hasNextPage: false }), false);
  });

  it('does not load while a request is in flight', () => {
    assert.equal(shouldLoadNextPage({ ...base, lastVisibleIndex: 19, isFetching: true }), false);
  });

  it('does not load for an empty list or when nothing is visible', () => {
    assert.equal(
      shouldLoadNextPage({ ...base, itemCount: 0, pageCount: 0, lastVisibleIndex: 0 }),
      false,
    );
    assert.equal(shouldLoadNextPage({ ...base, lastVisibleIndex: -1 }), false);
    assert.equal(shouldLoadNextPage({ ...base, lastVisibleIndex: Number.NaN }), false);
  });

  it('loads at once when the whole list is shorter than the threshold', () => {
    assert.equal(shouldLoadNextPage({ ...base, itemCount: 3, lastVisibleIndex: 0 }), true);
  });

  it('asks only once when the viewability callback fires repeatedly (guard owned by the caller)', () => {
    // Simulates the screen: it stores the page count it asked for and passes it back.
    let requestedForCount: number | undefined;
    let requests = 0;
    const onViewable = (lastVisibleIndex: number, itemCount: number, isFetching: boolean) => {
      const pageCount = itemCount / 20;
      if (
        shouldLoadNextPage({
          lastVisibleIndex,
          itemCount,
          pageCount,
          hasNextPage: true,
          isFetching,
          requestedForCount,
        })
      ) {
        requestedForCount = pageCount;
        requests += 1;
      }
    };

    onViewable(16, 20, false);
    onViewable(17, 20, true);
    onViewable(18, 20, false);
    onViewable(19, 20, false);
    assert.equal(requests, 1);

    onViewable(36, 40, false);
    onViewable(37, 40, false);
    assert.equal(requests, 2);
  });

  it('re-arms after the caller forgets the count (new identity, refresh or aborted page)', () => {
    const input = { ...base, lastVisibleIndex: 18 };
    assert.equal(shouldLoadNextPage({ ...input, requestedForCount: 1 }), false);
    assert.equal(shouldLoadNextPage({ ...input, requestedForCount: undefined }), true);
  });

  // RF-11 + RF-10. The guard counts PAGES, not items: a page whose ids are all repeated adds no
  // item, so a guard by length would stay closed for good and the list could never ask for page 3.
  describe('a page whose ids are all repeated (RF-11)', () => {
    it('still reopens the guard because the page count grew although the item count did not', () => {
      // Page 1 (20 items) was requested at 1 page. Page 2 lands with 20 repeated ids: the list
      // is still 20 items long, but 2 pages are loaded.
      const afterDuplicates = {
        lastVisibleIndex: 18,
        itemCount: 20,
        pageCount: 2,
        hasNextPage: true,
        isFetching: false,
        requestedForCount: 1,
      } as const;
      assert.equal(shouldLoadNextPage(afterDuplicates), true);
    });

    it('does not loop: asking for page 3 closes the guard again', () => {
      const afterDuplicates = {
        lastVisibleIndex: 18,
        itemCount: 20,
        pageCount: 2,
        hasNextPage: true,
        isFetching: false,
      } as const;
      assert.equal(shouldLoadNextPage({ ...afterDuplicates, requestedForCount: 1 }), true);
      assert.equal(shouldLoadNextPage({ ...afterDuplicates, requestedForCount: 2 }), false);
    });

    it('flatten keeps 20 items for those two pages, which is the situation above', () => {
      const first = page(Array.from({ length: 20 }, (_, i) => `p${i}`), {
        page: 1,
        totalPages: 3,
        total: 60,
      });
      const repeated = page(Array.from({ length: 20 }, (_, i) => `p${i}`), {
        page: 2,
        totalPages: 3,
        total: 60,
      });
      assert.equal(flattenUniqueProducts([first, repeated]).items.length, 20);
    });
  });
});

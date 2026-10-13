// Pagination rules for the product list (pure logic: no React Native, no RTK values).
//
// The mock paginates by OFFSET (`page` + `limit`, answering `{ items, page, totalPages, total }`),
// and RTK Query's infinite query keeps every page of one list in a single cache entry. These three
// functions are the rules around that entry: is there a next page, how do the pages become one
// list, and when should scrolling ask for the next page.

import type { CatalogProduct, ProductPage } from '../contracts/catalog-product.ts';

/** RF-10: the next page is requested when any of the last four items becomes visible. */
export const LOAD_MORE_THRESHOLD = 4;

/**
 * `getNextPageParam` of the infinite query: the number of the next page, or `undefined` when the
 * last one has been reached (RTK then reports `hasNextPage = false`).
 *
 * Takes only the two numbers it needs, so it accepts a whole `ProductPage` and is called by RTK
 * with `(lastPage, allPages, lastPageParam, ...)`: the extra arguments are ignored.
 *
 * - `totalPages = 0` (no matches) never has a next page.
 * - A `page` beyond `totalPages` (the server answers `items: []` for it) has none either.
 */
export function getNextPageParam({ page, totalPages }: Pick<ProductPage, 'page' | 'totalPages'>) {
  return page < totalPages ? page + 1 : undefined;
}

/** The list the screen shows: unique products plus the numbers of the most recent response. */
export type FlatProductList = Readonly<{
  items: readonly CatalogProduct[];
  /** Page number of the most recent response; `0` when no page has been loaded. */
  page: number;
  totalPages: number;
  /** Matches across all pages: the "N products" counter. */
  total: number;
}>;

/**
 * RF-11: concatenates the pages in order and keeps the FIRST copy of every id (and therefore its
 * position). Offset pagination can repeat an id when the catalog changes between two requests
 * (an insertion shifts the items of the next page); showing it twice would also break the stable
 * `keyExtractor`. `page`, `totalPages` and `total` come from the last page of the array, the most
 * recent response, because a refetched page carries fresher totals than the ones before it.
 *
 * Cost is O(n) over at most ~300 items, so it is recomputed per render (see plan, T15 measures).
 * Never mutates the pages; the products are the same objects as in the cache.
 */
export function flattenUniqueProducts(pages: readonly ProductPage[]): FlatProductList {
  const latest = pages[pages.length - 1];
  if (latest === undefined) {
    return { items: [], page: 0, totalPages: 0, total: 0 };
  }

  const seen = new Set<string>();
  const items: CatalogProduct[] = [];
  for (const { items: pageItems } of pages) {
    for (const item of pageItems) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        items.push(item);
      }
    }
  }

  return { items, page: latest.page, totalPages: latest.totalPages, total: latest.total };
}

/**
 * Highest index among the visible items of a viewability callback (`viewableItems`), or `-1` when
 * there is none. FlashList types `ViewToken.index` as `number | null`, and `Math.max` would turn a
 * single `null` into `0`, so the nulls are skipped explicitly. It takes only the field it reads, so
 * the pure logic does not import the library's type.
 */
export function getLastVisibleIndex(visible: readonly Readonly<{ index: number | null }>[]): number {
  let last = -1;
  for (const { index } of visible) {
    if (index !== null && index > last) {
      last = index;
    }
  }
  return last;
}

export type LoadNextPageInput = Readonly<{
  /** Highest index among the items currently visible (FlashList viewability); -1 if none. */
  lastVisibleIndex: number;
  /** Length of the list shown (`flattenUniqueProducts(...).items.length`): the threshold base. */
  itemCount: number;
  /** Pages loaded in the cache entry (`currentData.pages.length`): the base of the guard. */
  pageCount: number;
  /** `hasNextPage` of the infinite query hook. */
  hasNextPage: boolean;
  /** `isFetching` of the infinite query hook (any request on this entry: page, refresh...). */
  isFetching: boolean;
  /**
   * The number of loaded PAGES for which the caller already asked for the next one, or `undefined`
   * if it has not asked yet. The caller owns it (a `useRef` in the list hook); see "guard" below.
   * (The name comes from T6, where it counted items.)
   */
  requestedForCount: number | undefined;
}>;

/**
 * RF-10: should scrolling ask for the next page right now?
 *
 * Yes only when ALL hold: there is a next page, nothing is in flight, the list is not empty, the
 * visible area reaches the last `LOAD_MORE_THRESHOLD` items (index >= itemCount - 4: with 20 items,
 * index 15 does not load and 16 does; a list shorter than four loads at once) and the next page
 * has not already been requested for this number of loaded pages.
 *
 * The guard. Viewability callbacks fire many times per scroll, and `isFetching` flips only after
 * the request starts, so the number of loaded pages is what makes the request happen once: the
 * caller does
 *
 *   if (shouldLoadNextPage({ ..., requestedForCount: ref.current })) {
 *     ref.current = pageCount;
 *     fetchNextPage();
 *   }
 *
 * and the guard opens again by itself when a page lands and `pageCount` grows. The caller must
 * forget the count (`ref.current = undefined`) when:
 *
 * - the query identity changes (new filters, sort or search): the list is another one;
 * - a pull-to-refresh starts: the list is rebuilt from page 1 and may end with the same count;
 * - the in-flight next page is aborted by that refresh (it never landed, so the count did not
 *   grow). A FAILED next page does not reset it on purpose: the footer offers a manual retry, and
 *   automatic requests do not loop against a failing server.
 *
 * Why pages and not items (decided in T9). Offset pagination can return a page whose ids are all
 * repeated (RF-11); `flattenUniqueProducts` drops them, the item count does not grow, and a guard
 * by item count would stay closed until a refresh. Each page that lands grows `pageCount` by one
 * whatever it contains, so the guard always reopens. The threshold still uses `itemCount`: it is
 * about what the user can see. Residual limit: after such a page nothing "enters" the screen, so
 * the next request waits for the next viewability change (any scroll that moves the visible set).
 */
export function shouldLoadNextPage({
  lastVisibleIndex,
  itemCount,
  pageCount,
  hasNextPage,
  isFetching,
  requestedForCount,
}: LoadNextPageInput): boolean {
  if (!hasNextPage || isFetching || itemCount <= 0) {
    return false;
  }

  if (!Number.isFinite(lastVisibleIndex) || lastVisibleIndex < 0) {
    return false;
  }

  if (requestedForCount === pageCount) {
    return false;
  }

  return lastVisibleIndex >= itemCount - LOAD_MORE_THRESHOLD;
}

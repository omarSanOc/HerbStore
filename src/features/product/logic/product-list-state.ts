import type { ApiError } from '../../../core/api/api-error.ts';
import type { CatalogProduct, ProductPage } from '../contracts/catalog-product.ts';
import { flattenUniqueProducts } from './product-pages.ts';

/** Notice shown above products that are kept after a failed refresh. Same vocabulary as Home. */
export type ProductListNotice = 'offline' | 'update-failed';

/** What the end of the list shows: nothing, progress for the next page, or its failure + retry. */
export type ProductListFooter = 'idle' | 'loading-more' | 'load-more-failed';

/**
 * What the list screen renders. A discriminated union like `HomeScreenState`: the screen
 * `switch`es on `status` and the compiler checks every case.
 *
 * Refresh has no variant of its own: the products stay as `ready` (RF-12) and the pull spinner is
 * local UI state of `usePullToRefresh`.
 */
export type ProductListState =
  | { status: 'loading' }
  | {
      status: 'ready';
      products: readonly CatalogProduct[];
      /** Matches across all pages, from the most recent response. */
      total: number;
      footer: ProductListFooter;
      notice?: ProductListNotice;
    }
  | { status: 'empty' }
  | { status: 'offline' }
  | { status: 'error' };

/**
 * What the infinite-query hook knows, reduced to the facts the rules need:
 *
 * - `currentData`: the pages of the CURRENT args (never `data`, which RTK keeps from the previous
 *   args while the new ones load). `{ pages }` is the structural part of RTK's `InfiniteData`.
 * - `error`: the failure of the latest settled request, narrowed with `toApiError`. RTK 2.13 keeps
 *   it while the next request is pending and clears it only on success (see LEARNING.md, T4).
 * - `isFetching`: any request on the entry is in flight (first page, next page, refresh,
 *   revalidation or retry).
 * - `isFetchingNextPage` / `isFetchNextPageError`: RTK's direction flags. They are `true` only
 *   while a forward fetch is pending, or after one failed; a refresh resets the direction.
 */
export type ProductListSnapshot = Readonly<{
  currentData: Readonly<{ pages: readonly ProductPage[] }> | undefined;
  error: ApiError | undefined;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
}>;

/**
 * Pure rule that turns the hook snapshot into a screen state (RF-12, RF-19). It follows
 * `classifyHomeResult`, with the list-specific parts:
 *
 * - No products yet: `loading` for the first load, for new args (no `currentData`) and while
 *   retrying; `offline` (fetch failed without response: `network`) or `error` (5xx, timeout,
 *   invalid) once the failure settles. A cancellation (`aborted`) is never a failure.
 * - A query without matches (pages loaded, zero items, no failure) is `empty`, also while it is
 *   revalidated. A failed refresh over an empty result is the failure screen, as in Home.
 * - Products: always `ready` with the flattened unique list and the latest total.
 *   - The next page in flight gives the `loading-more` footer; its failure gives `load-more-failed`
 *     (the retry button). The list stays in both.
 *   - Any other failure over products keeps them with a notice (`offline` for `network`, else
 *     `update-failed`). The notice stays while the retry or revalidation is in flight and goes only
 *     when a success clears the error.
 *   - While a NEXT PAGE is fetching or has failed, the notice is not derived: RTK keeps the error
 *     of the previous request through the pending one, so it cannot tell a stale refresh failure
 *     from the failure the user is retrying. The footer already says what failed; once a success
 *     clears the error the state is clean.
 */
export function classifyProductListState({
  currentData,
  error,
  isFetching,
  isFetchingNextPage,
  isFetchNextPageError,
}: ProductListSnapshot): ProductListState {
  const pages = currentData?.pages ?? [];
  const list = flattenUniqueProducts(pages);
  const failure = error === undefined || error.kind === 'aborted' ? undefined : error;

  if (list.items.length > 0) {
    const forward = isFetchingNextPage || isFetchNextPageError;
    const footer: ProductListFooter = isFetchingNextPage
      ? 'loading-more'
      : isFetchNextPageError && failure !== undefined
        ? 'load-more-failed'
        : 'idle';
    const notice: ProductListNotice | undefined =
      failure === undefined || forward
        ? undefined
        : failure.kind === 'network'
          ? 'offline'
          : 'update-failed';

    return {
      status: 'ready',
      products: list.items,
      total: list.total,
      footer,
      ...(notice === undefined ? {} : { notice }),
    };
  }

  if (failure !== undefined && !isFetching) {
    return failure.kind === 'network' ? { status: 'offline' } : { status: 'error' };
  }

  if (pages.length > 0 && failure === undefined) {
    return { status: 'empty' };
  }

  return { status: 'loading' };
}

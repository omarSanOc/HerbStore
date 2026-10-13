import type { ApiError } from '../../../core/api/api-error.ts';
import type { ProductDetail } from '../contracts/catalog-product.ts';

/**
 * What the product route renders. A discriminated union, like `HomeScreenState`: the screen
 * `switch`es on `status` and the compiler checks every case.
 */
export type ProductLookupState =
  | { status: 'loading' }
  | { status: 'found'; product: ProductDetail }
  | { status: 'not-found' }
  | { status: 'offline' }
  | { status: 'error' };

/**
 * What `useGetProductQuery` knows, reduced to the facts the rules need (same three as Home):
 *
 * - `data`: the last SUCCESSFUL payload. RTK keeps it through a failed refetch.
 * - `error`: the failure of the latest settled request, narrowed with `toApiError`. RTK keeps it
 *   while the next request is pending and clears it only on success (see LEARNING.md, T4).
 * - `isFetching`: a request (first load, manual retry or revalidation) is in flight.
 */
export type ProductLookupSnapshot = Readonly<{
  data: ProductDetail | undefined;
  error: ApiError | undefined;
  isFetching: boolean;
}>;

/**
 * Pure rule that turns the query snapshot into a screen state. It keeps the Day 2 vocabulary:
 *
 * - A 404 is the one answer that means "this product does not exist": `not-found`. It wins even
 *   over cached data, because a revalidation that says 404 is newer than the cache.
 * - `network` (fetch failed without any response) is `offline`; 5xx, other 4xx, timeout and an
 *   invalid payload are `error`. They are never mixed up: offline suggests "check your
 *   connection", error suggests "the server had a problem".
 * - Without data, a request in flight is `loading`, so a manual retry shows the spinner and not
 *   the old failure that RTK keeps through `pending`. An `aborted` error is a cancellation.
 * - With data, any other failure keeps showing the product (the detail has no notice row: the
 *   figures on screen are the last ones received).
 */
export function classifyProductLookup({
  data,
  error,
  isFetching,
}: ProductLookupSnapshot): ProductLookupState {
  const failure = error === undefined || error.kind === 'aborted' ? undefined : error;

  if (failure?.kind === 'http' && failure.status === 404 && !(isFetching && data === undefined)) {
    return { status: 'not-found' };
  }

  if (data !== undefined) {
    return { status: 'found', product: data };
  }

  if (failure === undefined || isFetching) {
    return { status: 'loading' };
  }

  return failure.kind === 'network' ? { status: 'offline' } : { status: 'error' };
}

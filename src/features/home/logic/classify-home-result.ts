import type { ApiError } from '../../../core/api/api-error.ts';
import type { HomeData } from '../contracts/home.ts';

/** Notice shown above data that is kept after a failed refresh. */
export type HomeNotice = 'offline' | 'update-failed';

/**
 * What the screen renders. A discriminated union: each variant carries exactly the data it needs,
 * so the screen `switch`es on `status` and the compiler checks every case.
 */
export type HomeScreenState =
  | { status: 'loading' }
  | { status: 'ready'; data: HomeData; notice?: HomeNotice }
  | { status: 'empty' }
  | { status: 'offline' }
  | { status: 'error' };

/**
 * What the RTK Query hook knows about Home, reduced to the three facts the rules need:
 *
 * - `data`: the last SUCCESSFUL payload. RTK keeps it through a failed refetch.
 * - `error`: the failure of the latest settled request. RTK keeps it while the next request is
 *   pending and clears it only on success (checked in `buildHooks`/`buildSlice` of RTK 2.13).
 * - `isFetching`: a request (first load, retry, revalidation or pull) is in flight.
 */
export type HomeQuerySnapshot = Readonly<{
  data: HomeData | undefined;
  error: ApiError | undefined;
  isFetching: boolean;
}>;

/** Removes only the empty collections: banners, categories and each section without items. */
function withoutEmptyCollections(data: HomeData): HomeData {
  return {
    banners: data.banners,
    categories: data.categories,
    sections: data.sections.filter(({ items }) => items.length > 0),
  };
}

function hasContent({ banners, categories, sections }: HomeData): boolean {
  return banners.length > 0 || categories.length > 0 || sections.length > 0;
}

/**
 * Pure rule that turns the query snapshot into a screen state. It keeps the Day 2 behaviour:
 *
 * - Waiting (a request in flight, or nothing known yet): loading, or the cached data without a
 *   notice while refreshing. An `aborted` error is a cancellation, not a failure.
 * - Success replaces the previous data; empty collections are omitted one by one and only when
 *   everything is empty does the screen show `empty`.
 * - Failure with usable data keeps it plus a notice (`offline` when `fetch` failed without a
 *   response, i.e. `network`, otherwise `update-failed`); without usable data it is the offline
 *   screen or the error screen. HTTP errors (5xx), timeouts and invalid payloads are `error`,
 *   never `offline`.
 * - Because RTK keeps `error` through the next request, the old failure stays visible over DATA
 *   while it retries (the notice disappears only with a success), but without data a retry shows
 *   the skeleton again instead of the failure screen.
 */
export function classifyHomeResult({ data, error, isFetching }: HomeQuerySnapshot): HomeScreenState {
  const visible = data === undefined ? undefined : withoutEmptyCollections(data);
  const usable = visible !== undefined && hasContent(visible) ? visible : undefined;
  const failure = error === undefined || error.kind === 'aborted' ? undefined : error;
  const shownFailure = isFetching && data === undefined ? undefined : failure;

  if (shownFailure !== undefined) {
    if (usable !== undefined) {
      return {
        status: 'ready',
        data: usable,
        notice: shownFailure.kind === 'network' ? 'offline' : 'update-failed',
      };
    }

    return shownFailure.kind === 'network' ? { status: 'offline' } : { status: 'error' };
  }

  if (isFetching || visible === undefined) {
    return usable === undefined ? { status: 'loading' } : { status: 'ready', data: usable };
  }

  return usable === undefined ? { status: 'empty' } : { status: 'ready', data: usable };
}

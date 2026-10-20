import { skipToken } from '@reduxjs/toolkit/query/react';
import { useEffect, useRef } from 'react';

import { toApiError } from '@/core/api/api-error';
import { usePullToRefresh } from '@/core/api/use-pull-to-refresh';
import { useRevalidateWhenStale } from '@/core/api/use-revalidate-when-stale';

import { useGetProductsInfiniteQuery } from '../data/products-api';
import { classifyProductListState, type ProductListState } from '../logic/product-list-state';
import { getLastVisibleIndex, shouldLoadNextPage } from '../logic/product-pages';
import type { ProductQueryArgs } from '../logic/product-query';

/** What FlashList reports when the set of visible items changes (only the field we read). */
export type VisibleItemsChange = {
  viewableItems: readonly Readonly<{ index: number | null }>[];
};

export type ProductListViewModel = {
  /** What to draw: a discriminated union derived from the query, never stored. */
  state: ProductListState;
  /** The identity of the list as a string: the grid uses it as `key` to start over (and on top). */
  identity: string;
  /** The retry buttons of the failure screens and of the stale notice: refetch the list. */
  retry: () => void;
  /** The retry button of the footer: asks again for ONLY the page that failed. */
  retryNextPage: () => void;
  /** True while a pull-to-refresh runs over visible products. */
  isRefreshing: boolean;
  /** Pull-to-refresh. Ignored while a pull is already running. */
  onRefresh: () => void;
  /** FlashList's viewability callback: asks for the next page when the end gets close (RF-10). */
  onViewableItemsChanged: (change: VisibleItemsChange) => void;
};

/**
 * ViewModel of a product list: first page, scroll pagination, pull-to-refresh and the 60 s
 * revalidation, behind one state the screens only read.
 *
 * - `args` arrive canonical (`toProductQueryArgs` -> `buildProductQueryArgs`), so two equivalent
 *   lists share one cache entry and one in-flight request. Changing a filter, the sort OR the
 *   language changes the args, so RTK Query opens another entry: page 1, and the grid (keyed by
 *   identity) on top. The language in the args is what makes `es` and `en` separate caches (RF-24).
 * - `useGetProductsInfiniteQuery` owns the requests: cache, retries (2 on network/5xx) and abort.
 * - It reads `currentData`, never `data`. RTK keeps `data` from the previous args while new ones
 *   load, which would paint another list's products (or another LANGUAGE's) under the new title;
 *   `currentData` is `undefined` until the entry of the CURRENT args has a page (RF-11, RF-24).
 * - `classifyProductListState` (pure) turns the snapshot into the screen state.
 *
 * Load more (RF-10). The grid reports which items are visible; `shouldLoadNextPage` (pure) decides
 * and a `requestedForCount` ref is its guard: it holds the number of loaded PAGES for which the
 * next one was requested, so a burst of viewability callbacks asks once. It is forgotten when the
 * identity changes, when a pull starts and when the pull aborts the page in flight; a FAILED page
 * keeps it (no loop: the footer offers a manual retry).
 *
 * Pull-to-refresh (RF-6). RTK drops a `refetch` while the entry is pending, so a pull during
 * "load more" first aborts that page, waits for the abort to settle and then refetches ONLY page 1
 * (`refetchCachedPages: false`): the result starts from the new first page and the other cached
 * pages are discarded. The list stays on screen until the response arrives.
 *
 * Revalidation (RF-5). After 60 s the plain `refetch()` rebuilds EVERY cached page in sequence
 * and swaps the entry at the end, so the list does not change under the user and
 * `maintainVisibleContentPosition` keeps the position.
 *
 * `paused` (search, T12): while the text has not settled the screen keeps this view mounted (so
 * the filters the user chose survive a text edit) but asks for NOTHING: the query gets `skipToken`,
 * `currentData` is `undefined` and the state is `loading` (the skeleton). Results of an older text
 * can therefore never be shown while the new one is pending.
 *
 * Compose: a `ViewModel` with a `Pager` flow; the viewability callback is
 * `snapshotFlow { listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index }` and Paging's
 * `prefetchDistance`; cancelling the page is cancelling its `Job`. SwiftUI: `.onAppear` of the last
 * cells calling `loadMore()`; cancelling is cancelling the `Task`.
 */
export function useProductList(args: ProductQueryArgs, paused = false): ProductListViewModel {
  const identity = JSON.stringify(args);
  const {
    currentData,
    error,
    isFetching,
    isFetchingNextPage,
    isFetchNextPageError,
    hasNextPage,
    fulfilledTimeStamp,
    refetch,
    fetchNextPage,
  } = useGetProductsInfiniteQuery(paused ? skipToken : args);

  const state = classifyProductListState({
    currentData,
    error: toApiError(error),
    isFetching,
    isFetchingNextPage,
    isFetchNextPageError,
  });
  const pageCount = currentData?.pages.length ?? 0;
  const itemCount = state.status === 'ready' ? state.products.length : 0;

  // The guard of `shouldLoadNextPage`; a ref because a viewability callback must not re-render.
  const requestedForCount = useRef<number | undefined>(undefined);
  // The next page in flight, to abort it before a refresh. Cleared as soon as it settles.
  const nextPageRequest = useRef<ReturnType<typeof fetchNextPage> | undefined>(undefined);

  // Another list (new category, filters, sort or search): forget both.
  useEffect(() => {
    requestedForCount.current = undefined;
    nextPageRequest.current = undefined;
  }, [identity]);

  const requestNextPage = () => {
    requestedForCount.current = pageCount;
    const request = fetchNextPage();
    nextPageRequest.current = request;
    void request.then(() => {
      if (nextPageRequest.current === request) {
        nextPageRequest.current = undefined;
      }
    });
  };

  const onViewableItemsChanged = ({ viewableItems }: VisibleItemsChange) => {
    const shouldLoad = shouldLoadNextPage({
      lastVisibleIndex: getLastVisibleIndex(viewableItems),
      itemCount,
      pageCount,
      hasNextPage,
      isFetching,
      requestedForCount: requestedForCount.current,
    });
    if (!shouldLoad) {
      return;
    }

    if (__DEV__) {
      console.log(`[products] load more page ${pageCount + 1}`);
    }
    requestNextPage();
  };

  const { isRefreshing, onRefresh } = usePullToRefresh(async () => {
    if (__DEV__) {
      console.log('[products] pull refresh');
    }

    requestedForCount.current = undefined;
    const pending = nextPageRequest.current;
    nextPageRequest.current = undefined;
    if (pending !== undefined) {
      if (__DEV__) {
        console.log('[products] pull refresh: next page aborted');
      }
      pending.abort();
      // `abort()` only asks: the entry stays `pending` until the thunk settles, and RTK ignores a
      // `refetch` dispatched while it is pending (the pull would do nothing).
      await pending;
    }

    return refetch({ refetchCachedPages: false });
  });

  useRevalidateWhenStale({
    fulfilledTimeStamp,
    isFetching,
    refetch: () => {
      if (__DEV__) {
        console.log(`[products] revalidate (${pageCount} pages)`);
      }
      return refetch();
    },
  });

  return {
    state,
    identity,
    retry: () => {
      if (__DEV__) {
        console.log('[products] manual retry (retry button)');
      }
      void refetch();
    },
    retryNextPage: () => {
      if (__DEV__) {
        console.log(`[products] manual retry (next page ${pageCount + 1})`);
      }
      requestNextPage();
    },
    // The spinner only spins over visible products (same rule as Home).
    isRefreshing: isRefreshing && state.status === 'ready',
    onRefresh: () => {
      void onRefresh();
    },
    onViewableItemsChanged,
  };
}

import { useState } from 'react';

/**
 * Pull-to-refresh (RF-6): forces the request even if the cache is fresh, because it calls `refetch`
 * directly and never consults `shouldRevalidate`.
 *
 * `isRefreshing` is local and only the pull turns it on, so the background revalidation of
 * `useRevalidateWhenStale` (also a `refetch`) never lights the spinner. The list is not hidden:
 * the screen keeps drawing its cached data while `isRefreshing` is true. It turns off when the
 * request settles, successfully or not (RTK's promise resolves with the error; it does not throw).
 * If a request for the same entry is already in flight RTK does not start another one, and the
 * promise resolves when that one finishes.
 *
 * Compose: `PullToRefreshBox(isRefreshing, onRefresh)`; UIKit/SwiftUI: `UIRefreshControl` /
 * `.refreshable { await ... }`.
 */
export function usePullToRefresh(refetch: () => PromiseLike<unknown>) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const onRefresh = async () => {
    if (isRefreshing) {
      return;
    }

    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  return { isRefreshing, onRefresh };
}

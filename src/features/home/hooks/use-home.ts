import { toApiError } from '@/core/api/api-error';
import { usePullToRefresh } from '@/core/api/use-pull-to-refresh';
import { useRevalidateWhenStale } from '@/core/api/use-revalidate-when-stale';
import { useCurrentLanguage } from '@/core/i18n/use-current-language';

import { useGetHomeQuery } from '../data/home-api';
import { classifyHomeResult, type HomeScreenState } from '../logic/classify-home-result';

export type HomeViewModel = {
  /** What to draw: a discriminated union derived from the query, never stored. */
  state: HomeScreenState;
  /** True while a pull-to-refresh (or a manual retry) runs over visible data. */
  isRefreshing: boolean;
  /** Pull-to-refresh and the retry buttons. Ignored while a pull is already running. */
  refetch: () => void;
};

/**
 * Home's ViewModel, now on top of RTK Query: the public shape is the one of Day 2 (`state`,
 * `isRefreshing`, `refetch`), so `HomeScreen` did not change. Only the data source did.
 *
 * - `useGetHomeQuery` owns the request: caching, the single in-flight request per query, retries
 *   and cancellation. Opening Home refetches only if its data is 60 s old or more
 *   (`refetchOnMountOrArgChange: 60` in `baseApi`).
 * - The CURRENT language is part of the argument (`useCurrentLanguage`), so switching `es` ↔ `en`
 *   opens the entry of the new language and asks for it. `currentData` (never `data`) is what gets
 *   classified: while the new language loads, `currentData` is `undefined`, so the payload of the
 *   previous language is not drawn under the new chrome, and a late answer of the old language
 *   writes only its own entry (RF-24, RNF-3).
 * - `useRevalidateWhenStale` revalidates once, in the background and without a spinner, when Home
 *   regains focus, the app returns to the foreground or the network comes back, but only if the
 *   data is 60 s old or more (RF-5). It replaces the Day 2 refetch policy.
 * - `usePullToRefresh` forces the request even if the data is fresh (RF-6) and owns the spinner.
 * - `classifyHomeResult` (pure) turns `{ data, error, isFetching }` into the screen state.
 *
 * Compose: a `ViewModel` that used to collect a hand-written use case and now collects a
 * `Repository` `Flow` (`stateIn`); the composable does not notice. SwiftUI: an `@Observable` whose
 * `load()` swaps `URLSession` code for a shared client; the `View` keeps reading the same
 * properties.
 */
export function useHome(): HomeViewModel {
  const language = useCurrentLanguage();
  // `currentData`, NOT `data`: `data` keeps the payload of the previous ARGS (the previous
  // language) while the new ones load, which would draw Spanish content under English chrome.
  const { currentData, error, isFetching, fulfilledTimeStamp, refetch } = useGetHomeQuery(language);

  const { isRefreshing, onRefresh } = usePullToRefresh(() => {
    if (__DEV__) {
      console.log('[home] manual refetch (pull or retry button)');
    }
    return refetch();
  });

  useRevalidateWhenStale({
    fulfilledTimeStamp,
    isFetching,
    refetch: () => {
      if (__DEV__) {
        console.log('[home] background revalidation: data is 60 s old or more');
      }
      return refetch();
    },
  });

  const state = classifyHomeResult({ data: currentData, error: toApiError(error), isFetching });

  return {
    state,
    // The spinner only spins over visible data; the first load and a retry from the error screen
    // show the skeleton instead (same rule as Day 2).
    isRefreshing: isRefreshing && state.status === 'ready',
    refetch: () => {
      void onRefresh();
    },
  };
}

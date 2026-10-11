import { useNavigation } from 'expo-router';
import { useEffect, useReducer } from 'react';
import { AppState } from 'react-native';

import { apiOrigin } from '@/core/network/api-origin';

import { fetchHome } from '../data/home-client';
import { homeFixture } from '../data/home-fixture-env';
import type { HomeScreenState } from '../logic/classify-home-result';
import {
  homeRequestReducer,
  initialHomeRequestState,
  selectHomeScreenState,
  selectIsRefreshing,
} from '../logic/home-request-state';
import { shouldRefetchOnFocus, shouldRefetchOnForeground } from '../logic/refetch-policy';

export type HomeViewModel = {
  /** What to draw: a discriminated union derived from the requests, never stored. */
  state: HomeScreenState;
  /** True while a pull-to-refresh (or any refetch) runs over visible data. */
  isRefreshing: boolean;
  /** Pull-to-refresh and the retry buttons. Ignored while a request is already in flight. */
  refetch: () => void;
};

/**
 * Orchestrates Home's request. The rules live in pure modules (`homeRequestReducer`,
 * `selectHomeScreenState`, `shouldRefetchOnForeground`, `shouldRefetchOnFocus`); this hook only
 * connects them to React:
 *
 * - The request starts with the screen (initial state is "pending") and restarts whenever
 *   `requestId` changes. The effect owns an `AbortController`: leaving the screen or starting
 *   another request cancels the previous one, and an answer is delivered together with the id of
 *   the request that produced it, so a late answer of an older request is dropped by the reducer.
 * - Nothing calls `setState` synchronously inside an effect; triggers dispatch from event
 *   callbacks (pull, button, AppState, navigation focus).
 * - Returning to the app (with Home focused) refetches ALWAYS; regaining navigation focus refetches
 *   only to recover from a failure. If both fire on the same tick the reducer keeps a single
 *   request, because a `refetch` while one is pending changes nothing.
 */
export function useHome(): HomeViewModel {
  const [request, dispatch] = useReducer(homeRequestReducer, initialHomeRequestState);
  const navigation = useNavigation();
  const { requestId } = request;

  useEffect(() => {
    const controller = new AbortController();

    void fetchHome({ origin: apiOrigin, signal: controller.signal, fixture: homeFixture }).then(
      (outcome) => {
        if (controller.signal.aborted) {
          return;
        }
        if (__DEV__) {
          console.log(`[home] request ${requestId} settled: ${outcome.kind}`);
        }
        dispatch({ type: 'settled', requestId, outcome });
      },
    );

    return () => controller.abort();
  }, [requestId]);

  // Derived in render: each listener only exists while its pure rule says a refetch is allowed,
  // so none is armed while a request is in flight and there is no stale state to read at event
  // time.
  const refetchOnForeground = shouldRefetchOnForeground(request);
  const refetchOnFocus = shouldRefetchOnFocus(request);

  useEffect(() => {
    if (!refetchOnForeground) {
      return;
    }

    const appStateSubscription = AppState.addEventListener('change', (status) => {
      // A Home that is not on screen (another tab, a pushed product, the scanner) refetches
      // through the focus rule when it comes back instead.
      if (status === 'active' && navigation.isFocused()) {
        if (__DEV__) {
          console.log('[home] refetch on foreground');
        }
        dispatch({ type: 'refetch' });
      }
    });

    return () => appStateSubscription.remove();
  }, [refetchOnForeground, navigation]);

  useEffect(() => {
    if (!refetchOnFocus) {
      return;
    }

    return navigation.addListener('focus', () => {
      if (__DEV__) {
        console.log('[home] refetch on focus after a failure');
      }
      dispatch({ type: 'refetch' });
    });
  }, [refetchOnFocus, navigation]);

  return {
    state: selectHomeScreenState(request),
    isRefreshing: selectIsRefreshing(request),
    refetch: () => dispatch({ type: 'refetch' }),
  };
}

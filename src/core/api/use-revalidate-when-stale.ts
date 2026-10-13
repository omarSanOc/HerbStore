import { useIsFocused } from 'expo-router';
import { useEffect, useEffectEvent, useRef } from 'react';

import { useIsAppActive } from '@/core/lifecycle/use-app-active';
import { onReconnect } from '@/core/network/reconnection';

import { shouldRevalidate } from './freshness';

type RevalidateWhenStaleInput = {
  /** `fulfilledTimeStamp` of the query hook result; `undefined` until the first success. */
  fulfilledTimeStamp: number | undefined;
  isFetching: boolean;
  /** `refetch` of the query hook. For infinite queries it refetches every cached page. */
  refetch: () => unknown;
};

/**
 * Background revalidation after 60 s (RF-5). Three triggers share ONE rule, `shouldRevalidate`:
 *
 * - the screen regains navigation focus (back from a product, switching tabs),
 * - the app returns to the foreground,
 * - the device goes from offline to online (`onReconnect`).
 *
 * If the data is older than 60 s and no request is running it calls `refetch()` once, without any
 * spinner: the cached data stays on screen and only `isFetching` flips. If several triggers fire
 * together the second sees `isFetching` and RTK itself drops a request for an entry already in
 * flight, so there is a single request.
 *
 * Deliberately not here:
 * - The mount: `refetchOnMountOrArgChange: 60` already covers opening the screen.
 * - A screen that is not visible (another tab, covered by a pushed screen, app in background): it
 *   neither listens to reconnections nor refetches; it catches up when it regains focus.
 * - A screen with no data yet: there is nothing to revalidate; the manual retry covers it.
 *
 * The state that changes is read through `useEffectEvent`, so the effects only depend on
 * visibility and never re-subscribe because a timestamp changed. Compose: the equivalent of a
 * `repeatOnLifecycle(STARTED)` that calls `refresh()` when the data is old; SwiftUI: `.task` /
 * `onChange(of: scenePhase)`.
 */
export function useRevalidateWhenStale({
  fulfilledTimeStamp,
  isFetching,
  refetch,
}: Readonly<RevalidateWhenStaleInput>) {
  const isFocused = useIsFocused();
  const isAppActive = useIsAppActive();
  const isVisible = isFocused && isAppActive;
  const wasVisible = useRef(isVisible);

  const revalidateIfStale = useEffectEvent(() => {
    if (shouldRevalidate({ fulfilledTimeStamp, now: Date.now(), isFetching })) {
      void refetch();
    }
  });

  // Focus and foreground: only on the transition hidden -> visible, not on mount.
  useEffect(() => {
    if (isVisible && !wasVisible.current) {
      revalidateIfStale();
    }
    wasVisible.current = isVisible;
  }, [isVisible]);

  // Reconnection: one shared native subscription behind `onReconnect`; this screen listens only
  // while it is visible.
  useEffect(() => {
    if (!isVisible) {
      return;
    }

    return onReconnect(() => revalidateIfStale());
  }, [isVisible]);
}

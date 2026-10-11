import { useIsFocused } from 'expo-router';
import { useEffect, useEffectEvent, useState } from 'react';

import { useIsAppActive } from '@/core/lifecycle/use-app-active';

import { isBannerInteracting, type BannerInteractionState } from './banner-interaction';
import { AUTOPLAY_INTERVAL_MS, nextBannerIndex, shouldAutoplay } from './carousel-autoplay';

type UseBannerAutoplayOptions = {
  count: number;
  /** Current banner; the pager owns it. */
  index: number;
  /** The pager's own way of moving (state + scroll, animated unless reduced motion). */
  goTo: (target: number) => void;
  /** False until the carousel has been measured: before that there is nothing to scroll. */
  isReady: boolean;
  /** The banner row is inside Home's vertical viewport (`onViewableItemsChanged`). */
  isRowVisible: boolean;
  reduceMotion: boolean;
  /** What the user is doing with the carousel (see `banner-interaction.ts`). */
  interaction: BannerInteractionState;
  /** Forget a gesture that may never report its end (see the visibility gate below). */
  resetInteraction: () => void;
};

/**
 * Banner autoplay (RF-12, RF-13, RNF-2): ONE `setTimeout` of 5 s that exists only while
 * `shouldAutoplay` says so, and is reinstalled whenever the banner, the condition or the epoch of
 * the user's interactions changes.
 *
 * - Why `setTimeout` and not `setInterval`: with an interval the 5 s count would keep running
 *   through every pause and resume mid-way. Here a pause destroys the timer and a resume builds a
 *   new one, so every way back (finger lifted, app active, row visible, tab focused, motion
 *   allowed) waits a FULL 5 s. Each advance changes `index`, which reinstalls the timer too: the
 *   next wait is also full, and measured from the moment the new banner is shown.
 * - The effect declares what its timer depends on (`autoplay`, `index`, `epoch`) and its cleanup
 *   clears the timer: that cleanup runs before the next run of the effect and on unmount, so
 *   there are never two timers and never an orphan one.
 * - What the timer does when it fires goes through `useEffectEvent`: the effect does not
 *   re-run when `goTo` changes (it changes on every render), but the call always sees the latest
 *   one, never a stale closure. Compose: `rememberUpdatedState`.
 * - Focus (`useIsFocused`), foreground (`useIsAppActive`) and viewport (`isRowVisible`) are values
 *   derived in render, not mirrored by effects; reduced motion is the existing preference hook.
 *   Several mechanisms on purpose: none of them alone covers a tab switch, a pushed product, a
 *   modal, the background and a carousel scrolled out of the screen.
 */
export function useBannerAutoplay({
  count,
  index,
  goTo,
  isReady,
  isRowVisible,
  reduceMotion,
  interaction,
  resetInteraction,
}: Readonly<UseBannerAutoplayOptions>) {
  const isFocused = useIsFocused();
  const isAppActive = useIsAppActive();
  const isVisible = isFocused && isAppActive && isRowVisible;

  // A gesture can lose its end if the carousel stops being visible mid-touch (the app goes to
  // the background, the row leaves the viewport). When visibility drops, forget the gesture so
  // that coming back starts clean. React's "adjust state while rendering" pattern: it compares
  // with the previous value kept in state and only writes when it changed.
  const [wasVisible, setWasVisible] = useState(isVisible);
  if (wasVisible !== isVisible) {
    setWasVisible(isVisible);
    if (!isVisible) {
      resetInteraction();
    }
  }

  const autoplay =
    isReady &&
    shouldAutoplay({
      bannerCount: count,
      isFocused,
      isAppActive,
      isRowVisible,
      reducedMotion: reduceMotion,
      isInteracting: isBannerInteracting(interaction),
    });
  const { epoch } = interaction;

  const advance = useEffectEvent(() => goTo(nextBannerIndex(index, count)));

  useEffect(() => {
    if (!autoplay) {
      return;
    }

    if (__DEV__) {
      console.log(`[BannerAutoplay] armed (banner ${index + 1}/${count}, epoch ${epoch})`);
    }
    const timer = setTimeout(() => {
      if (__DEV__) {
        console.log('[BannerAutoplay] fired');
      }
      advance();
    }, AUTOPLAY_INTERVAL_MS);

    return () => {
      clearTimeout(timer);
      if (__DEV__) {
        console.log('[BannerAutoplay] cleared');
      }
    };
    // `index` and `epoch` do not change how the timer is built: they are WHY it must be rebuilt.
  }, [autoplay, index, epoch, count]);
}

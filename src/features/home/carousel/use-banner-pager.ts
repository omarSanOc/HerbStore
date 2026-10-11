import { useRef, useState } from 'react';
import type { FlatList, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import type { BannerInteractionEvent } from './banner-interaction';
import {
  clampBannerIndex,
  offsetForIndex,
  indexFromOffset,
  stepBannerIndex,
  type BannerStep,
} from './banner-pager';

type UseBannerPagerOptions = {
  count: number;
  /** Width of one page in dp; 0 until the carousel has been measured. */
  pageWidth: number;
  /** Programmatic scrolling (buttons, accessibility actions) jumps instead of animating. */
  reduceMotion: boolean;
  /**
   * Reports the USER's gestures on the list (finger down / up, drag begin / end) and nothing else:
   * a scroll started by `goTo` (buttons, accessibility actions, autoplay) never reports, which is
   * how the autoplay tells a person from the pager's own programmatic scroll. The pager arms no
   * timer; whoever listens decides what a gesture means.
   */
  onGesture?: (event: Exclude<BannerInteractionEvent, 'reset'>) => void;
};

/**
 * State and scrolling of a paged horizontal list: which banner is current, how to move to
 * another one and how to keep the two in sync.
 *
 * - The index is React state (the dots and the spoken value depend on it), but it changes only
 *   when a scroll SETTLES (`onMomentumScrollEnd`), never on every scroll frame: a frame-by-frame
 *   `setState` would re-render the carousel 60 times per swipe for nothing.
 * - Moving by button or accessibility action updates the state at once and scrolls; the settle
 *   event that follows an animated scroll writes the same number, so it is idempotent.
 * - `onMomentumScrollEnd` also fires after a programmatic `scrollToOffset`, so it only syncs the
 *   index; it is NOT reported as the end of a user gesture (`onScrollEndDrag` and the touch
 *   events are).
 * - When the page width changes (rotation, split screen, tablet) the scroll offset no longer
 *   points at the current page; the content-size change realigns it without animation.
 */
export function useBannerPager<Item>({
  count,
  pageWidth,
  reduceMotion,
  onGesture,
}: Readonly<UseBannerPagerOptions>) {
  const listRef = useRef<FlatList<Item>>(null);
  const [index, setIndex] = useState(0);

  const goTo = (target: number) => {
    const next = clampBannerIndex(target, count);
    setIndex(next);
    listRef.current?.scrollToOffset({
      offset: offsetForIndex(next, pageWidth, count),
      animated: !reduceMotion,
    });
  };

  const step = (direction: BannerStep) => goTo(stepBannerIndex(index, count, direction));

  const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(indexFromOffset(event.nativeEvent.contentOffset.x, pageWidth, count));
  };

  const onContentSizeChange = () => {
    listRef.current?.scrollToOffset({
      offset: offsetForIndex(index, pageWidth, count),
      animated: false,
    });
  };

  return {
    listRef,
    index,
    goTo,
    step,
    listHandlers: {
      onMomentumScrollEnd,
      onContentSizeChange,
      onScrollBeginDrag: () => onGesture?.('dragStart'),
      onScrollEndDrag: () => onGesture?.('dragEnd'),
      onTouchStart: () => onGesture?.('touchStart'),
      onTouchEnd: () => onGesture?.('touchEnd'),
      onTouchCancel: () => onGesture?.('touchEnd'),
    },
  };
}

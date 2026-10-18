import { useRef, type RefObject } from 'react';
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  View,
} from 'react-native';

import { useReducedMotionPreference } from '@/core/accessibility/use-reduced-motion';

import { getScrollOffsetToReveal } from './scroll-into-view';

type ScrollReveal = {
  /** Goes on the `ScrollView`, with the two handlers below. */
  scrollRef: RefObject<ScrollView | null>;
  /**
   * Goes on the ONE view that wraps all the scroll content (the child of the `ScrollView`, with no
   * padding of the container before it): the target is measured against it, so its offsets are
   * already in scroll coordinates. The typings of `ScrollView` do not expose its inner view.
   */
  contentRef: RefObject<View | null>;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onLayout: (event: LayoutChangeEvent) => void;
  /** Scrolls, if needed, so `target` (a view inside the scroll content) is fully visible. */
  reveal: (target: View | null) => void;
};

/**
 * Lets a screen bring a view of its scroll content into sight (`getScrollOffsetToReveal`), along the
 * vertical axis or, for a horizontal `ScrollView` (a row of chips), the horizontal one: the
 * hook only remembers the scroll offset and the viewport height of the `ScrollView` it is wired to
 * and measures the target against the scroll content when asked. Without animation when the system
 * asks for reduced motion.
 *
 * It keeps two numbers in refs, not in state: nothing on screen depends on them, so tracking the
 * scroll must not re-render the screen on every frame.
 *
 * Compose: `rememberScrollState()` + `BringIntoViewRequester`. SwiftUI: `ScrollViewReader`.
 */
export function useScrollReveal(
  margin: number,
  axis: 'vertical' | 'horizontal' = 'vertical',
): ScrollReveal {
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const offset = useRef(0);
  const viewportSize = useRef(0);
  const reduceMotion = useReducedMotionPreference();

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current =
      axis === 'vertical' ? event.nativeEvent.contentOffset.y : event.nativeEvent.contentOffset.x;
  };
  const onLayout = (event: LayoutChangeEvent) => {
    viewportSize.current =
      axis === 'vertical' ? event.nativeEvent.layout.height : event.nativeEvent.layout.width;
  };

  const reveal = (target: View | null) => {
    const scroll = scrollRef.current;
    const content = contentRef.current;
    if (target === null || scroll === null || content === null) {
      return;
    }

    target.measureLayout(
      content,
      (x, y, width, height) => {
        const next = getScrollOffsetToReveal({
          targetTop: axis === 'vertical' ? y : x,
          targetHeight: axis === 'vertical' ? height : width,
          scrollOffset: offset.current,
          viewportHeight: viewportSize.current,
          margin,
        });
        if (next !== undefined) {
          scroll.scrollTo(
            axis === 'vertical'
              ? { y: next, animated: !reduceMotion }
              : { x: next, animated: !reduceMotion },
          );
        }
      },
      () => {},
    );
  };

  return { scrollRef, contentRef, onScroll, onLayout, reveal };
}

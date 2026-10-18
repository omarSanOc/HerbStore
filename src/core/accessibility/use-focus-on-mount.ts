import { useEffect, useRef, type RefObject } from 'react';

import { moveScreenReaderFocus, type ScreenReaderFocusTarget } from './screen-reader-focus';

/** Pause before the focus move; see `useFocusOnMount`. */
export const FOCUS_ON_MOUNT_DELAY_MS = 700;

/**
 * Puts the screen-reader focus on the element this ref is attached to (a screen's title) once the
 * screen has mounted. For screens that REPLACE the one where the user just pressed a button
 * (checkout -> order status -> confirmation): the focused button disappears, and TalkBack then
 * parks its focus on the first focusable thing it finds, which on the Samsung was the "Home" tab,
 * so the user heard "Home" instead of "Order confirmed". A pushed screen needs none of this: the
 * reader starts at its Back arrow, which is where it should start.
 *
 * Compose: `LaunchedEffect(Unit) { focusRequester.requestFocus() }` on the title.
 * SwiftUI: `.onAppear { focus = .title }` with `@AccessibilityFocusState`.
 */
export function useFocusOnMount<T extends ScreenReaderFocusTarget>(): RefObject<T | null> {
  const ref = useRef<T>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      moveScreenReaderFocus(ref.current);
    }, FOCUS_ON_MOUNT_DELAY_MS);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  return ref;
}

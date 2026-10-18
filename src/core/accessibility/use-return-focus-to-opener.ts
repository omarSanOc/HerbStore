import { useIsFocused } from 'expo-router';
import { useEffect, useRef, type RefObject } from 'react';

import { moveScreenReaderFocus, type ScreenReaderFocusTarget } from './screen-reader-focus';

/**
 * Pause between the screen becoming focused again and the focus move. TalkBack parks its own focus
 * on the first element of a screen a moment after it reappears (~0.7 s on the Samsung); a move made
 * before that is overwritten by it. Measured, see `docs/evidence/day-6-accessibility.md`.
 */
export const RETURN_FOCUS_DELAY_MS = 900;

type ReturnFocus<T extends ScreenReaderFocusTarget> = {
  /** Put this on the control that opens the modal. */
  openerRef: RefObject<T | null>;
  /** Call it when the control actually opens the modal (inside the navigation, not before). */
  markOpening: () => void;
};

/**
 * Gives the screen-reader focus back to the control that opened a MODAL ROUTE (the scanner) when
 * the modal closes and the screen is focused again. Spec 006: closing a modal returns the focus to
 * the control that opened it. A bottom sheet does it inside `AppBottomSheet` (it knows when it
 * closes); a route modal is a different screen, so the opener screen does it by itself.
 *
 * It only acts on the focus that follows an opening done through `markOpening`: a tab switch or
 * the app coming back to the foreground also re-focus the screen, and must not move the reader.
 * The move is a timer that dies with the screen.
 *
 * Compose: restoring a `FocusRequester` in `onResume`. SwiftUI/UIKit: dismissing a presented
 * controller returns VoiceOver to the presenting control by itself.
 */
export function useReturnFocusToOpener<T extends ScreenReaderFocusTarget>(): ReturnFocus<T> {
  const isFocused = useIsFocused();
  const openerRef = useRef<T>(null);
  // A flag, not state: setting it must not re-render, and nothing draws from it.
  const waitingForReturn = useRef(false);

  useEffect(() => {
    if (!isFocused || !waitingForReturn.current) {
      return;
    }
    waitingForReturn.current = false;

    const timer = setTimeout(() => {
      moveScreenReaderFocus(openerRef.current);
    }, RETURN_FOCUS_DELAY_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [isFocused]);

  const markOpening = () => {
    waitingForReturn.current = true;
  };

  return { openerRef, markOpening };
}

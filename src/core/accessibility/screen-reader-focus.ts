import { AccessibilityInfo } from 'react-native';

/** What the screen reader can be sent to: the instance a `ref` holds (a `View`, a `Text`...). */
export type ScreenReaderFocusTarget = Parameters<typeof AccessibilityInfo.sendAccessibilityEvent>[0];

/**
 * Pause between moving the screen-reader focus and announcing what happened.
 *
 * Why it exists: TalkBack and VoiceOver speak the newly focused element and that speech INTERRUPTS
 * whatever is being said. An announcement made at the same moment as a focus change (or just
 * before it) is cut off: on the Samsung, "“vit” removed from recent searches" was stopped about two
 * seconds in because TalkBack moved its focus to the search field. Announcing after the focus has
 * landed queues the message behind the focus speech instead of fighting it. The value was chosen
 * from the TalkBack event/TTS trace in `docs/evidence/day-6-accessibility.md`.
 */
export const ANNOUNCE_AFTER_FOCUS_MS = 350;

/**
 * Moves the screen-reader focus to `target`. The event is the standard one of each platform: on
 * Android a `TYPE_VIEW_FOCUSED` event the screen reader answers by focusing that node; on iOS a
 * layout-changed notification with the view as argument. Without a screen reader it is inert, so
 * callers do not need to check for one. A target that is gone (a `ref` that is `null`) is ignored.
 */
export function moveScreenReaderFocus(target?: ScreenReaderFocusTarget | null): void {
  if (target !== undefined && target !== null) {
    AccessibilityInfo.sendAccessibilityEvent(target, 'focus');
  }
}

/**
 * `moveScreenReaderFocus(target)` and, after `ANNOUNCE_AFTER_FOCUS_MS`, announces `message` (when
 * there is one). Returns a function that cancels the pending announcement, for a component to call
 * when it unmounts.
 *
 * Compose: `focusRequester.requestFocus()` then `view.announceForAccessibility(message)`; SwiftUI:
 * set an `@AccessibilityFocusState` and post `AccessibilityNotification.Announcement(message)`.
 */
export function moveFocusThenAnnounce(
  target?: ScreenReaderFocusTarget | null,
  message?: string,
): () => void {
  moveScreenReaderFocus(target);

  if (message === undefined) {
    return () => {};
  }

  const timer = setTimeout(() => {
    AccessibilityInfo.announceForAccessibility(message);
  }, ANNOUNCE_AFTER_FOCUS_MS);

  return () => {
    clearTimeout(timer);
  };
}

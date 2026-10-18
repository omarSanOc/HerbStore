import { useSyncExternalStore } from 'react';
import { Dimensions, type EmitterSubscription } from 'react-native';

// ONE shared subscription to the window's `change` event, however many components read the font
// scale (every `AppText` does): the store only notifies when the scale actually differs, so a text does
// not render again for any other window change.
const listeners = new Set<() => void>();
let nativeSubscription: EmitterSubscription | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  nativeSubscription ??= Dimensions.addEventListener('change', () => {
    listeners.forEach((notify) => notify());
  });

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      nativeSubscription?.remove();
      nativeSubscription = undefined;
    }
  };
}

function getSnapshot() {
  return Dimensions.get('window').fontScale;
}

/**
 * The system text size multiplier (Android `font_scale`, iOS Dynamic Type), live: it changes while
 * the app is open when the user changes the size in Settings.
 *
 * Android: `Configuration.fontScale` / `onConfigurationChanged` (the Activity is recreated);
 * iOS: `UIContentSizeCategory.didChangeNotification`; Compose: `LocalDensity.current.fontScale`;
 * SwiftUI: `@Environment(\.dynamicTypeSize)`.
 */
export function useFontScale(): number {
  return useSyncExternalStore(subscribe, getSnapshot, () => 1);
}

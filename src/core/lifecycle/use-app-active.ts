import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

function subscribe(onChange: () => void) {
  const subscription = AppState.addEventListener('change', onChange);
  return () => subscription.remove();
}

// `inactive` (iOS: control center, app switcher, an incoming call) is NOT active either: the
// screen may still be drawn but the person is not looking at the carousel.
const getSnapshot = () => AppState.currentState === 'active';

/**
 * Is the app in the foreground? `AppState` is an external store (it lives outside React and
 * notifies on change), which is exactly what `useSyncExternalStore` is for: React reads the
 * snapshot during render and re-renders when it changes, with no state mirrored by hand and no
 * effect that calls `setState`. Compose: `LocalLifecycleOwner` + `collectAsState` of the
 * lifecycle; SwiftUI: `@Environment(\.scenePhase) == .active`.
 */
export function useIsAppActive(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot);
}

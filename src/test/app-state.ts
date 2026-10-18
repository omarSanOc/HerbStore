/// <reference types="jest" />
import { AppState } from 'react-native';

/**
 * Jest has no real application lifecycle: `AppState.currentState` is not `'active'`, so a screen
 * that revalidates only while the app is in the foreground (`useIsAppActive`) would never do it,
 * and the scanner would not turn its camera on. Call it in `beforeEach` of a test that needs the
 * app to be in the foreground.
 *
 * Compose: `ActivityScenario.moveToState(RESUMED)`. XCUITest: `XCUIApplication().activate()`.
 */
export function setAppForeground() {
  Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true, writable: true });
}

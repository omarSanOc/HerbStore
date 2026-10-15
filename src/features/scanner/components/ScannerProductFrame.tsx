import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/design-system';

type ScannerProductFrameProps = {
  children: ReactNode;
};

/**
 * Frame of the product opened FROM the scanner (`/scanner/product/<id>`): it reserves the bottom
 * system inset for the screen it wraps.
 *
 * Why it exists: the product detail pins its purchase bar to the bottom edge and, by design, adds
 * no bottom inset of its own. Under the tab navigator that is correct, because the tab bar sits
 * under the screen and already covers the Android navigation bar / iOS home indicator. The scanner
 * is a modal with NO tab bar and the app draws edge-to-edge, so the same screen put "Add to cart"
 * under the system bar (Android) and over the home indicator (iOS). Adding the inset inside the
 * detail would count it twice in every tab route, so only THIS route asks for it.
 *
 * Only the bottom edge: the header of the inner stack already covers the top, and the app is locked
 * to portrait, so there are no side insets. `SafeAreaView` adds the native inset as padding.
 *
 * Why the surface color: the padding strip shows THIS view's background. The purchase bar is
 * `colors.surface`, so the strip uses the same color and reads as one taller bar, instead of a
 * slightly different band under it (the page background is a different tone, in light and dark).
 * Trade-off: while the detail has no bar (loading, not found, error) the strip stays `surface` under
 * a `background` page; it is only as tall as the system inset (34 pt on iOS, 48 dp with the Android
 * three-button bar, where the opaque system bar covers it anyway). Discarded: an opt-in inset in
 * `StickyAddBar`/`ProductDetailScreen` (it follows the bar's own state, but widens the API of a
 * screen shared with the tab routes for one caller, and forgetting it brings back the overlap).
 *
 * Compose: `Scaffold(bottomBar = { BottomAppBar(modifier = Modifier.navigationBarsPadding()) })`,
 * or `Modifier.navigationBarsPadding()` on the container; SwiftUI: `.safeAreaInset(edge: .bottom)`
 * (the system already keeps a pinned view above the home indicator, while RN draws under it).
 */
export function ScannerProductFrame({ children }: Readonly<ScannerProductFrameProps>) {
  const { colors } = useAppTheme();

  return (
    <SafeAreaView edges={['bottom']} style={[styles.frame, { backgroundColor: colors.surface }]}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
  },
});

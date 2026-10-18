import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ColorValue } from 'react-native';
import { Platform, View, useWindowDimensions } from 'react-native';

import { fixedIconGeometry } from '../icon-size';

type AppIconProps = {
  /** SF Symbol on iOS, Material Symbol on Android: `{ ios, android, web }`. */
  name: SymbolViewProps['name'];
  size?: number;
  color?: ColorValue;
};

/**
 * A DECORATIVE icon: the control that holds it always carries its own text or label, so the icon
 * must never be a stop of the screen reader nor part of what it reads.
 *
 * Why the wrapper `View` and not props on `SymbolView` (S-1): on Android `SymbolView` is a `View`
 * with a `Text` that draws one character of the Material Symbols font, and it forwards ONLY
 * `style`, `size` and `tintColor`: `accessibilityElementsHidden` and `importantForAccessibility`
 * were silently dropped, so TalkBack read the private-use glyph as a letter ("壳", "嬉") and the
 * magnifier became a focus stop of its own. On iOS the native view takes those props, so the bug
 * did not show there. The `View` is a real host view that always receives them:
 * `importantForAccessibility="no-hide-descendants"` (Android) hides the whole subtree and
 * `accessibilityElementsHidden` (iOS) does the same for VoiceOver. It states its own width and height.
 *
 * The icon keeps its size whatever the system font size (H-1/H-11 = S-4, T6c). That `Text` scales
 * with `font_scale` while its box (`size` x `size`) does not, so from 1.3x the glyph outgrew the box
 * and the tab bar, the search field and the carousel arrows showed a clipped corner of it. A
 * `Text` cannot opt out through `SymbolView`, so on Android the font size is divided by the scale (the
 * system multiplies it back to `size`) and the box is stated explicitly, because `SymbolView`
 * would give the `Text` a smaller box and cut it again. An SF Symbol of iOS is a fixed number of
 * points and never needed it. Compose: `Modifier.size(24.dp)` is in dp and never scales; SwiftUI: a
 * fixed `.font(.system(size:))` ignores Dynamic Type.
 *
 * Compose: `Icon(imageVector, contentDescription = null)` (null = decorative) or
 * `Modifier.clearAndSetSemantics {}`; SwiftUI: `Image(systemName:).accessibilityHidden(true)`;
 * Android Views: `android:importantForAccessibility="no"`; UIKit: `isAccessibilityElement = false`.
 */
export function AppIcon({ name, size = 24, color }: Readonly<AppIconProps>) {
  const { fontScale } = useWindowDimensions();
  const { box, fontSize } =
    Platform.OS === 'android' ? fixedIconGeometry(size, fontScale) : fixedIconGeometry(size, 1);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: box, height: box }}>
      <SymbolView name={name} size={fontSize} style={{ width: box, height: box }} tintColor={color} />
    </View>
  );
}

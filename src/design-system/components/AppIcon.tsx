import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ColorValue } from 'react-native';
import { View } from 'react-native';

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
 * `accessibilityElementsHidden` (iOS) does the same for VoiceOver. It adds no layout of its own: it
 * wraps the icon box exactly.
 *
 * Compose: `Icon(imageVector, contentDescription = null)` (null = decorative) or
 * `Modifier.clearAndSetSemantics {}`; SwiftUI: `Image(systemName:).accessibilityHidden(true)`;
 * Android Views: `android:importantForAccessibility="no"`; UIKit: `isAccessibilityElement = false`.
 */
export function AppIcon({ name, size = 24, color }: Readonly<AppIconProps>) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <SymbolView name={name} size={size} tintColor={color} />
    </View>
  );
}

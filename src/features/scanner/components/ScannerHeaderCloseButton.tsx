import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useReducedMotionPreference } from '@/core/accessibility/use-reduced-motion';
import { sizes, useAppTheme } from '@/design-system';
import { useGoBackOrHome } from '@/features/navigation/use-go-back-or-home';

const GLYPH_SIZE = 20;
const BAR_LENGTH = 22;
const BAR_THICKNESS = 2;

/**
 * Left action of the scanner screen header (`scanner/index`): it closes the whole modal and returns
 * to the screen that opened it (RF-19). It is the FIRST screen of the inner scanner stack, so the
 * header has no back arrow of its own to offer; the scanned product, one level above, does and
 * keeps the native arrow, which only pops back to "Ready to scan".
 *
 * Why a close button and not an arrow: the two exits mean different things and must not look the
 * same. An X dismisses the modal; an arrow goes back one level inside it.
 *
 * Why the X is drawn with two bars and not with `AppIcon`: on Android `SymbolView` draws a font
 * glyph whose box is fixed but whose text scales with the system font, so from about 1.3x the X was
 * cut to a stroke (the H-1/H-11 audit finding). This is the only visible way out of the modal, so it
 * cannot depend on a font. The bars have no text, so there is nothing to scale or clip; the touch
 * target stays 48 dp whatever the font size. Discarded: fixing `AppIcon` for the whole app, which
 * belongs to the Day 6 audit, not to this fix.
 *
 * Compose: a `TopAppBar` `navigationIcon` that calls the OUTER `NavController.popBackStack()`;
 * SwiftUI: a `ToolbarItem(placement: .cancellationAction)` that calls the sheet's `dismiss()`.
 */
export function ScannerHeaderCloseButton() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const reduceMotion = useReducedMotionPreference();
  const close = useGoBackOrHome();

  return (
    <Pressable
      accessibilityHint={t('scanner.closeHint')}
      accessibilityLabel={t('scanner.close')}
      accessibilityRole="button"
      onPress={close}
      style={({ pressed }) => [styles.target, pressed && !reduceMotion ? styles.pressed : null]}>
      {/* Decorative: the button already carries the spoken label, so the drawing is hidden from
          TalkBack and VoiceOver (same rule as `AppIcon`). */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.glyph}>
        <View style={[styles.bar, styles.barDown, { backgroundColor: colors.text }]} />
        <View style={[styles.bar, styles.barUp, { backgroundColor: colors.text }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  target: {
    minHeight: sizes.minimumTouchTarget,
    minWidth: sizes.minimumTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    width: GLYPH_SIZE,
    height: GLYPH_SIZE,
  },
  bar: {
    position: 'absolute',
    top: (GLYPH_SIZE - BAR_THICKNESS) / 2,
    left: (GLYPH_SIZE - BAR_LENGTH) / 2,
    width: BAR_LENGTH,
    height: BAR_THICKNESS,
    borderRadius: BAR_THICKNESS / 2,
  },
  barDown: {
    transform: [{ rotate: '45deg' }],
  },
  barUp: {
    transform: [{ rotate: '-45deg' }],
  },
  pressed: {
    opacity: 0.72,
  },
});

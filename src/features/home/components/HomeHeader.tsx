import type { Ref } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useReducedMotionPreference } from '@/core/accessibility/use-reduced-motion';
import {
  AppIcon,
  AppText,
  fontScaleLimits,
  radii,
  sizes,
  spacing,
  useAppTheme,
} from '@/design-system';

type HomeHeaderProps = {
  onSearchPress: () => void;
  onScanPress: () => void;
  /** The scan button's view: when the scanner (a modal) closes, the screen reader goes back to it. */
  scanButtonRef?: Ref<View>;
};

/**
 * Search entry and scanner access. The "field" is a button: typing happens on the search screen
 * (Day 3), so Home only needs to open it. Both targets are at least 48 dp tall/wide; the search
 * label wraps when the system font grows, with a cap so a long word is not split in the middle
 * (`fontScaleLimits.searchField`).
 */
export function HomeHeader({ onSearchPress, onScanPress, scanButtonRef }: Readonly<HomeHeaderProps>) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const reduceMotion = useReducedMotionPreference();

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityHint={t('home.header.searchHint')}
        accessibilityLabel={t('home.header.searchLabel')}
        accessibilityRole="button"
        onPress={onSearchPress}
        style={({ pressed }) => [
          styles.search,
          { backgroundColor: colors.surface, borderColor: colors.controlBorder },
          pressed && !reduceMotion ? styles.pressed : null,
        ]}>
        <AppIcon
          name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
          size={22}
          color={colors.textMuted}
        />
        <AppText
          maxFontSizeMultiplier={fontScaleLimits.searchField}
          style={styles.placeholder}
          tone="muted">
          {t('home.header.searchPlaceholder')}
        </AppText>
      </Pressable>
      <Pressable
        ref={scanButtonRef}
        accessibilityHint={t('home.header.scanHint')}
        accessibilityLabel={t('home.header.scanLabel')}
        accessibilityRole="button"
        onPress={onScanPress}
        style={({ pressed }) => [
          styles.scan,
          { backgroundColor: colors.primary },
          pressed && !reduceMotion ? styles.pressed : null,
        ]}>
        <AppIcon
          name={{ ios: 'barcode.viewfinder', android: 'qr_code_scanner', web: 'qr_code_scanner' }}
          size={24}
          color={colors.onPrimary}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
  },
  search: {
    flex: 1,
    minHeight: sizes.minimumTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  placeholder: {
    flex: 1,
  },
  scan: {
    // Stretches with the search field when the text wraps; never smaller than the touch target.
    minHeight: sizes.minimumTouchTarget,
    minWidth: sizes.minimumTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderCurve: 'continuous',
  },
  pressed: {
    opacity: 0.72,
  },
});

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useTranslation } from 'react-i18next';

import { useReducedMotionPreference } from '@/core/accessibility/use-reduced-motion';
import { AppText, fontScaleLimits, radii, sizes, spacing, useAppTheme } from '@/design-system';

type SwipeToDeleteProps = Readonly<{
  children: ReactNode;
  disabled: boolean;
  onDelete: () => void;
}>;

/**
 * Horizontal reveal only. RNGH waits for 24 pt of horizontal travel and its detector declares
 * `touchAction="pan-y"`, so a vertical drag remains the parent ScrollView's gesture. The revealed
 * control is hidden from the accessibility tree because CartLine also provides a visible button.
 */
export function SwipeToDelete({ children, disabled, onDelete }: SwipeToDeleteProps) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const reduceMotion = useReducedMotionPreference();

  const renderRightActions = () => (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.actionFrame}>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onDelete}
        style={({ pressed }) => [
          styles.action,
          { backgroundColor: colors.primary },
          pressed && !reduceMotion ? styles.pressed : null,
        ]}>
        <AppText maxFontSizeMultiplier={fontScaleLimits.actionLabel} tone="onPrimary" variant="label">
          {t('cart.line.delete')}
        </AppText>
      </Pressable>
    </View>
  );

  return (
    <ReanimatedSwipeable
      dragOffsetFromRightEdge={24}
      enabled={!disabled}
      overshootRight={false}
      renderRightActions={renderRightActions}
      rightThreshold={56}>
      {children}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  actionFrame: {
    // `minWidth`, not `width` (T6f): the label scales up to 2x and a fixed 112 split "Delete" into
    // "Dele / te" at iOS AX5. The frame keeps 112 at normal size and grows with a larger label.
    minWidth: 112,
    paddingLeft: spacing.sm,
  },
  action: {
    minWidth: sizes.minimumTouchTarget,
    minHeight: sizes.minimumTouchTarget,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderCurve: 'continuous',
  },
  pressed: {
    opacity: 0.72,
  },
});

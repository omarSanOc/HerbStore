import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useReducedMotionPreference } from '@/core/accessibility/use-reduced-motion';
import { AppText, spacing, useAppTheme } from '@/design-system';

/**
 * Blocking state while redux-persist decides which cart is safe to show (RF-11). With reduced motion
 * the endless spinner is left out and the title and message stand alone (RF-15, T6c).
 */
export function CartRestoring() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const reduceMotion = useReducedMotionPreference();

  return (
    <View accessibilityLiveRegion="polite" style={styles.content}>
      {reduceMotion ? null : (
        <ActivityIndicator accessibilityLabel={t('cart.restoring.title')} color={colors.primary} size="large" />
      )}
      <AppText accessibilityRole="header" variant="subheading">
        {t('cart.restoring.title')}
      </AppText>
      <AppText tone="muted">{t('cart.restoring.message')}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
});

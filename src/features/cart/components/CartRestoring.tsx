import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, spacing, useAppTheme } from '@/design-system';

/** Blocking state while redux-persist decides which cart is safe to show (RF-11). */
export function CartRestoring() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();

  return (
    <View accessibilityLiveRegion="polite" style={styles.content}>
      <ActivityIndicator accessibilityLabel={t('cart.restoring.title')} color={colors.primary} size="large" />
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

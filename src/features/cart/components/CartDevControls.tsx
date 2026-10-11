import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppButton, AppSurface, AppText, radii, spacing } from '@/design-system';

import { cartCountSource } from '../cart-count-source';
import { useCartCount } from '../use-cart-count';

/**
 * Development-only control to drive the tab badge to 0, 5 and 100.
 * Render it behind `__DEV__`; Day 4 removes it when the real cart exists.
 */
export function CartDevControls() {
  const { t } = useTranslation();
  const count = useCartCount();

  return (
    <AppSurface style={styles.card}>
      <AppText accessibilityRole="header" variant="subheading">
        {t('cartDev.heading')}
      </AppText>
      <AppText tone="muted">{t('cartDev.description')}</AppText>
      <AppText>{t('cartDev.count', { count })}</AppText>
      <View style={styles.row}>
        <AppButton
          accessibilityHint={t('cartDev.addOneHint')}
          label={t('cartDev.addOne')}
          onPress={() => cartCountSource.add(1)}
        />
        <AppButton
          accessibilityHint={t('cartDev.addTenHint')}
          label={t('cartDev.addTen')}
          onPress={() => cartCountSource.add(10)}
        />
        <AppButton
          accessibilityHint={t('cartDev.resetHint')}
          label={t('cartDev.reset')}
          onPress={() => cartCountSource.reset()}
        />
      </View>
    </AppSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    borderCurve: 'continuous',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});

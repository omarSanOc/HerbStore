import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppSurface, AppText, fontScaleLimits, radii, spacing, useAppTheme } from '@/design-system';
import { formatMoney } from '@/features/preferences/logic/currency';

import type { ShippingProgress as ShippingProgressModel } from '../logic/cart-selectors';

type ShippingProgressProps = Readonly<{
  progress: ShippingProgressModel;
  language: string;
}>;

/** Canonical verdict from the selector, with amounts formatted only at the view boundary. */
export function ShippingProgress({ progress, language }: ShippingProgressProps) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const threshold = formatMoney(progress.thresholdCents, progress.currency, language);
  const remaining = formatMoney(progress.remainingCents, progress.currency, language);
  const message = progress.qualifies
    ? t('cart.shipping.qualified')
    : t('cart.shipping.remaining', { amount: remaining });
  const percent = Math.round(progress.fraction * 100);

  return (
    <AppSurface style={[styles.card, { borderColor: colors.border }]}>
      <AppText maxFontSizeMultiplier={fontScaleLimits.actionLabel} variant="label">
        {t('cart.shipping.title')}
      </AppText>
      <AppText maxFontSizeMultiplier={fontScaleLimits.actionLabel}>{message}</AppText>
      <View
        accessibilityLabel={t('cart.shipping.progressLabel')}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: percent, text: message }}
        style={[styles.track, { backgroundColor: colors.border }]}>
        <View style={[styles.fill, { backgroundColor: colors.primary, width: `${percent}%` }]} />
      </View>
      <AppText maxFontSizeMultiplier={fontScaleLimits.actionLabel} tone="muted">
        {t('cart.shipping.threshold', { amount: threshold })}
      </AppText>
    </AppSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  track: {
    height: spacing.sm,
    overflow: 'hidden',
    borderRadius: radii.pill,
  },
  fill: {
    height: '100%',
    borderRadius: radii.pill,
  },
});

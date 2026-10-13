import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useAppDispatch, useAppSelector } from '@/core/store/hooks';
import { AppButton, AppSurface, AppText, radii, spacing } from '@/design-system';

import { currencyChanged, selectPreferredCurrency } from '../store/preferences-slice';

/**
 * Chooses the currency every price is shown in (MXN or USD). Two `AppButton selected` like the
 * language selector of Fundamentals: the selected one is filled and announced as "selected".
 * The preference lives in memory (Day 6 persists it), so the description says it resets on restart.
 *
 * Compose: a `SingleChoiceSegmentedButtonRow`; SwiftUI: a `Picker` with `.segmented` style.
 */
export function CurrencySelector() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const currency = useAppSelector(selectPreferredCurrency);

  return (
    <AppSurface style={styles.card}>
      <AppText accessibilityRole="header" variant="subheading">
        {t('preferences.currency.heading')}
      </AppText>
      <AppText tone="muted">{t('preferences.currency.description')}</AppText>
      <View style={styles.row}>
        <AppButton
          accessibilityHint={t('preferences.currency.selectMxnHint')}
          label={t('preferences.currency.mxn')}
          onPress={() => dispatch(currencyChanged('MXN'))}
          selected={currency === 'MXN'}
        />
        <AppButton
          accessibilityHint={t('preferences.currency.selectUsdHint')}
          label={t('preferences.currency.usd')}
          onPress={() => dispatch(currencyChanged('USD'))}
          selected={currency === 'USD'}
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

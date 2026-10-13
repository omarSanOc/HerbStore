import { ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppButton, AppText, sizes, spacing } from '@/design-system';

type EmptyCartProps = Readonly<{ onGoHome: () => void }>;

/** Empty state keeps the next action explicit and makes the unavailable checkout visible (RF-10). */
export function EmptyCart({ onGoHome }: EmptyCartProps) {
  const { t } = useTranslation();

  return (
    <ScrollView contentContainerStyle={styles.scroll} contentInsetAdjustmentBehavior="automatic">
      <AppText accessibilityRole="header" variant="subheading">
        {t('cart.empty.title')}
      </AppText>
      <AppText tone="muted">{t('cart.empty.message')}</AppText>
      <AppButton
        accessibilityHint={t('cart.empty.goHomeHint')}
        label={t('cart.empty.goHome')}
        onPress={onGoHome}
        variant="primary"
      />
      <AppButton
        accessibilityHint={t('cart.checkout.emptyHint')}
        disabled
        label={t('cart.checkout.label')}
        onPress={() => undefined}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    width: '100%',
    maxWidth: sizes.contentMaxWidth,
    flexGrow: 1,
    alignSelf: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
});

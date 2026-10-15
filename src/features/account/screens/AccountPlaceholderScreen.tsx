import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AppButton } from '@/design-system';
import { PlaceholderScreen } from '@/features/navigation/screens/PlaceholderScreen';
import { CurrencySelector } from '@/features/preferences/components/CurrencySelector';

export function AccountPlaceholderScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <PlaceholderScreen body={t('placeholders.account.body')}>
      {/* The only currency control of Day 4; Day 6 replaces it with the final preferences. */}
      <CurrencySelector />
      <AppButton
        accessibilityHint={t('placeholders.account.openFoundationsHint')}
        label={t('placeholders.account.openFoundations')}
        onPress={() => router.push('/foundations')}
      />
      <AppButton
        accessibilityHint={t('placeholders.account.openDeviceInsightsHint')}
        label={t('placeholders.account.openDeviceInsights')}
        onPress={() => router.push('/(tabs)/(account)/device-insights')}
      />
    </PlaceholderScreen>
  );
}

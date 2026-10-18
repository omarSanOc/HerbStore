import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AppButton } from '@/design-system';
import { PlaceholderScreen } from '@/features/navigation/screens/PlaceholderScreen';
import { useNavigationLockout } from '@/features/navigation/use-navigation-lockout';
import { CurrencySelector } from '@/features/preferences/components/CurrencySelector';
import { LanguageSelector } from '@/features/preferences/components/LanguageSelector';
import { ThemeSelector } from '@/features/preferences/components/ThemeSelector';

/** Account: the user's preferences (language, currency, theme), "My orders" and the way to the learning screens. */
export function AccountScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  // Every destination is a singular route: a double tap opens one screen.
  const navigate = useNavigationLockout();

  return (
    <PlaceholderScreen body={t('placeholders.account.body')}>
      <LanguageSelector />
      <CurrencySelector />
      <ThemeSelector />
      <AppButton
        accessibilityHint={t('placeholders.account.openOrdersHint')}
        label={t('placeholders.account.openOrders')}
        onPress={() => navigate(() => router.push('/(tabs)/(account)/orders'))}
      />
      <AppButton
        accessibilityHint={t('placeholders.account.openFoundationsHint')}
        label={t('placeholders.account.openFoundations')}
        onPress={() => navigate(() => router.push('/foundations'))}
      />
      <AppButton
        accessibilityHint={t('placeholders.account.openDeviceInsightsHint')}
        label={t('placeholders.account.openDeviceInsights')}
        onPress={() => navigate(() => router.push('/(tabs)/(account)/device-insights'))}
      />
    </PlaceholderScreen>
  );
}

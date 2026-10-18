import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useStackScreenOptions } from '@/features/navigation/use-stack-screen-options';

export default function AccountLayout() {
  const { t } = useTranslation();
  const screenOptions = useStackScreenOptions();
  // iOS derives the Back label from the title of the screen underneath, and it does not refresh
  // that label while the screen is covered: change the language on Foundations and Back kept the
  // old language until the next navigation. Setting it on the VISIBLE screens, from the current
  // language, keeps it right (Android has no back label).
  const backTitle = t('placeholders.account.title');

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="account" options={{ title: t('placeholders.account.title') }} />
      <Stack.Screen
        name="orders"
        // One instance per route name: a double tap cannot stack two lists of orders.
        dangerouslySingular
        options={{ headerBackTitle: backTitle, title: t('orders.title') }}
      />
      <Stack.Screen
        name="foundations"
        // One instance per route name: a double tap cannot stack two Foundations screens.
        dangerouslySingular
        options={{ headerBackTitle: backTitle, title: t('placeholders.foundations.title') }}
      />
      <Stack.Screen
        name="device-insights"
        dangerouslySingular
        options={{ headerBackTitle: backTitle, title: t('deviceInsights.title') }}
      />
    </Stack>
  );
}

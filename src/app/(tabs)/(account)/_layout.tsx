import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useStackScreenOptions } from '@/features/navigation/use-stack-screen-options';

export default function AccountLayout() {
  const { t } = useTranslation();
  const screenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="account" options={{ title: t('placeholders.account.title') }} />
      <Stack.Screen
        name="foundations"
        // One instance per route name: a double tap cannot stack two Foundations screens.
        dangerouslySingular
        options={{ title: t('placeholders.foundations.title') }}
      />
    </Stack>
  );
}

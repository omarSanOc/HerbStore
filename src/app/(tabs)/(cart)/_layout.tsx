import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useStackScreenOptions } from '@/features/navigation/use-stack-screen-options';

export default function CartLayout() {
  const { t } = useTranslation();
  const screenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="cart" options={{ title: t('placeholders.cart.title') }} />
    </Stack>
  );
}

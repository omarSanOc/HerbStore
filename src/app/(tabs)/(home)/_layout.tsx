import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useStackScreenOptions } from '@/features/navigation/use-stack-screen-options';

// A link to `/product/<id>` puts Home (`index`) under the product, so Back returns to Inicio.
export const unstable_settings = {
  anchor: 'index',
};

export default function HomeLayout() {
  const { t } = useTranslation();
  const screenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: t('placeholders.home.title') }} />
      <Stack.Screen
        name="product/[id]"
        // The route name is the identity, so product A then product B leaves a single product
        // screen (B) and repeated taps never stack two. `true` would key by id and allow both.
        dangerouslySingular={(name) => name}
        options={{ title: t('product.title') }}
      />
      <Stack.Screen
        name="category/[id]"
        // Same rule as product: one category screen at a time, so a banner or category tapped
        // twice (or two at once) opens a single instance.
        dangerouslySingular={(name) => name}
        options={{ title: t('category.title') }}
      />
      <Stack.Screen
        name="search"
        dangerouslySingular={(name) => name}
        options={{ title: t('search.title') }}
      />
    </Stack>
  );
}

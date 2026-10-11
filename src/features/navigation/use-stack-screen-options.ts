import type { NativeStackNavigationOptions } from 'expo-router';

import { useAppTheme } from '@/design-system';

/** Header and content colors for every tab stack, derived from the app theme. */
export function useStackScreenOptions(): NativeStackNavigationOptions {
  const { colors } = useAppTheme();

  return {
    headerStyle: { backgroundColor: colors.surface },
    headerTintColor: colors.text,
    headerTitleStyle: { color: colors.text },
    contentStyle: { backgroundColor: colors.background },
  };
}

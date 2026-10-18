import type { ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { useAppSelector } from '@/core/store/hooks';
import { AppThemeProvider } from '@/design-system';

import { resolveColorScheme } from '../logic/preferences';
import { selectThemePreference } from '../store/preferences-slice';

/**
 * Feeds the app theme from the user's preference. `system` follows `useColorScheme()`, which
 * re-renders when the OS changes its appearance with the app open (RF-10); `light`/`dark` are
 * resolved from the state in the same render, without waiting for the native round trip of
 * `Appearance.setColorScheme` (that call is for the native parts: alerts, keyboard, system sheets).
 *
 * Compose: `isSystemInDarkTheme()` combined with the stored choice inside `HerbStoreTheme`.
 * SwiftUI: `.preferredColorScheme(choice)` where `nil` means "follow the system".
 */
export function PreferencesThemeProvider({ children }: Readonly<{ children: ReactNode }>) {
  const preference = useAppSelector(selectThemePreference);
  const system = useColorScheme();

  return <AppThemeProvider scheme={resolveColorScheme(preference, system)}>{children}</AppThemeProvider>;
}

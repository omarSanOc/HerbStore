/// <reference types="jest" />
import { render, type RenderOptions } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { I18nextProvider } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as ReduxProvider } from 'react-redux';

import { i18n, type SupportedLanguage } from '@/core/i18n';
import { PreferencesThemeProvider } from '@/features/preferences/components/PreferencesThemeProvider';

import { createTestStore } from './fixtures';

/** A phone-sized window with a notch and a home indicator, so insets are non-zero but stable. */
const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

type RenderWithProvidersOptions = Readonly<{
  /** Defaults to Spanish, the fallback language of the app. */
  language?: SupportedLanguage;
  /** The system color scheme the theme provider will read. Defaults to light. */
  colorScheme?: 'light' | 'dark';
  /** A store created (and seeded) by the test; by default each render gets a fresh one. */
  store?: ReturnType<typeof createTestStore>;
}> &
  Omit<RenderOptions, 'wrapper'>;

/**
 * `render` with what the real root layout provides: Redux store, i18n and the theme fed by the
 * preferences (same order as `src/app/_layout.tsx`), plus the safe-area provider that expo-router mounts itself. Navigation and native providers are NOT included on purpose: a test that
 * needs a router mocks it explicitly.
 *
 * Returns the store too, so a test can read the state after interacting.
 *
 * Compose: a `setContent { AppTheme { ... } }` wrapper in `createComposeRule`. SwiftUI: a preview
 * with `.environment(...)` injected.
 */
export async function renderWithProviders(
  ui: ReactElement,
  { language = 'es', colorScheme = 'light', store = createTestStore(), ...options }: RenderWithProvidersOptions = {},
) {
  await i18n.changeLanguage(language);
  // jest-expo replaces `useColorScheme` with a `jest.fn`; it is the seam the theme provider reads.
  jest.mocked(useColorScheme).mockReturnValue(colorScheme);

  function Wrapper({ children }: Readonly<{ children: ReactNode }>) {
    return (
      <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
        <ReduxProvider store={store}>
          <I18nextProvider i18n={i18n}>
            <PreferencesThemeProvider>{children}</PreferencesThemeProvider>
          </I18nextProvider>
        </ReduxProvider>
      </SafeAreaProvider>
    );
  }

  const result = await render(ui, { ...options, wrapper: Wrapper });
  return { ...result, store };
}

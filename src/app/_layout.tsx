import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { I18nextProvider, useTranslation } from 'react-i18next';

import { i18n } from '@/core/i18n';
import { AppThemeProvider } from '@/design-system';
import { useStackScreenOptions } from '@/features/navigation/use-stack-screen-options';

// A link straight to a screen of a child navigator (or to the scanner) still gets the tabs, and
// therefore Home, underneath, so Back has somewhere to go. Without it the stack would be empty.
export const unstable_settings = {
  anchor: '(tabs)',
};

// Inside its own component because the theme and i18n hooks need the providers above it.
function RootStack() {
  const { t } = useTranslation();
  const stackOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={{ ...stackOptions, headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="scanner"
        // One scanner at a time: a double tap or a repeated link cannot stack a second modal.
        dangerouslySingular
        options={{
          headerShown: true,
          presentation: 'modal',
          title: t('scanner.title'),
        }}
      />
      <Stack.Screen
        name="+not-found"
        // iOS would label the back button with the raw group name "(tabs)": show only the arrow.
        options={{
          headerBackButtonDisplayMode: 'minimal',
          headerShown: true,
          title: t('notFound.title'),
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <I18nextProvider i18n={i18n}>
      <AppThemeProvider>
        <StatusBar style="auto" />
        <RootStack />
      </AppThemeProvider>
    </I18nextProvider>
  );
}

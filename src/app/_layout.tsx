import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { I18nextProvider } from 'react-i18next';

import { i18n } from '@/core/i18n';
import { AppThemeProvider } from '@/design-system';

export default function RootLayout() {
  return (
    <I18nextProvider i18n={i18n}>
      <AppThemeProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }} />
      </AppThemeProvider>
    </I18nextProvider>
  );
}

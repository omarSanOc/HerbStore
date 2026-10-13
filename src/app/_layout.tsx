import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { Provider as ReduxProvider } from 'react-redux';

import { HiddenWhileSheetOpen } from '@/core/accessibility/HiddenWhileSheetOpen';
import { i18n } from '@/core/i18n';
import { store } from '@/core/store/store';
import { AppThemeProvider } from '@/design-system';
import { GlobalErrorScreen } from '@/features/navigation/screens/GlobalErrorScreen';
import { useStackScreenOptions } from '@/features/navigation/use-stack-screen-options';

// A link straight to a screen of a child navigator (or to the scanner) still gets the tabs, and
// therefore Home, underneath, so Back has somewhere to go. Without it the stack would be empty.
export const unstable_settings = {
  anchor: '(tabs)',
};

/** Expo Router wraps this root route with its installed `{ error, retry }` boundary contract. */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <GlobalErrorScreen retry={retry} />;
}

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
    // Gesture Handler needs one root view for its gestures to work (the bottom sheets of T10 depend
    // on it). It must fill the screen, hence `flex: 1`.
    <GestureHandlerRootView style={styles.root}>
      <ReduxProvider store={store}>
        <I18nextProvider i18n={i18n}>
          <AppThemeProvider>
            <StatusBar style="auto" />
            {/* Host of every `BottomSheetModal`: inside the theme and i18n because the sheets are
                drawn in a portal of this provider, and above the stack so they cover the tabs. The
                app is hidden from screen readers while a sheet is open; the sheets are outside. */}
            <BottomSheetModalProvider>
              <HiddenWhileSheetOpen>
                <RootStack />
              </HiddenWhileSheetOpen>
            </BottomSheetModalProvider>
          </AppThemeProvider>
        </I18nextProvider>
      </ReduxProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

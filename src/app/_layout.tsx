import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { Provider as ReduxProvider } from 'react-redux';

import { HiddenWhileSheetOpen } from '@/core/accessibility/HiddenWhileSheetOpen';
import { PublicConfigGate } from '@/core/config/PublicConfigGate';
import { i18n } from '@/core/i18n';
import { store } from '@/core/store/store';
import { holdSplash, useReleaseSplash } from '@/core/startup/splash';
import { selectIsRehydrated } from '@/core/store/rehydration';
import { useAppSelector } from '@/core/store/hooks';
import { useAppTheme } from '@/design-system';
import { GlobalErrorScreen } from '@/features/navigation/screens/GlobalErrorScreen';
import { notFoundScreenOptions } from '@/features/navigation/not-found-options';
import { useStackScreenOptions } from '@/features/navigation/use-stack-screen-options';
import { useNotificationResponseNavigation } from '@/features/notifications/hooks/use-notification-response-navigation';
import { PreferencesThemeProvider } from '@/features/preferences/components/PreferencesThemeProvider';

// Keep the native splash over the first frames: the language and theme the user chose are applied
// after the persisted preferences are read. `useReleaseSplash` lets it go (at most ~1 s later).
void holdSplash();

// A link straight to a screen of a child navigator (or to the scanner) still gets the tabs, and
// therefore Home, underneath, so Back has somewhere to go. Without it the stack would be empty.
export const unstable_settings = {
  anchor: '(tabs)',
};

/** Expo Router wraps this root route with its installed `{ error, retry }` boundary contract. */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <GlobalErrorScreen retry={retry} />;
}

/** Releases the splash when the preferences are restored, and keeps the status bar on the theme. */
function StartupEffects() {
  useReleaseSplash(useAppSelector(selectIsRehydrated));
  const { scheme } = useAppTheme();
  // Explicit light/dark text from the RESOLVED theme (also right when the OS and the app disagree).
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
}

// Inside its own component because the theme and i18n hooks need the providers above it.
function RootStack() {
  useNotificationResponseNavigation();
  const { t } = useTranslation();
  const stackOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={{ ...stackOptions, headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="scanner"
        // One scanner at a time: a double tap or a repeated link cannot stack a second modal.
        dangerouslySingular
        // No header here (it is already off in `screenOptions`): a header of THIS stack would
        // belong to the whole modal and its arrow would always dismiss it, even over the scanned
        // product. The inner stack (`scanner/_layout.tsx`) draws its own header per screen.
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="+not-found"
        // iOS would label the back button with the raw group name "(tabs)": icon-only arrow with a
        // translated accessible label (H-T8-7).
        options={notFoundScreenOptions({ title: t('notFound.title'), back: t('notFound.back') })}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    // Gesture Handler needs one root view for its gestures to work (the bottom sheets of T10 depend
    // on it). It must fill the screen, hence `flex: 1`.
    <GestureHandlerRootView style={styles.root}>
      {/* Redux is the outermost provider: the language and the theme are preferences in the store,
          so the i18n and theme providers below read from it. */}
      <ReduxProvider store={store}>
        <I18nextProvider i18n={i18n}>
          <PreferencesThemeProvider>
            {/* Outside the gate on purpose: the splash must be released even on the setup screen. */}
            <StartupEffects />
            <PublicConfigGate>
              {/* Host of every `BottomSheetModal`: inside the theme and i18n because the sheets are
                drawn in a portal of this provider, and above the stack so they cover the tabs. The
                app is hidden from screen readers while a sheet is open; the sheets are outside. */}
              <BottomSheetModalProvider>
                <HiddenWhileSheetOpen>
                  <RootStack />
                </HiddenWhileSheetOpen>
              </BottomSheetModalProvider>
            </PublicConfigGate>
          </PreferencesThemeProvider>
        </I18nextProvider>
      </ReduxProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

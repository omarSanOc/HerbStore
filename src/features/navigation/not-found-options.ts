import type { NativeStackNavigationOptions } from 'expo-router';

/**
 * Options of the `+not-found` screen in the root Stack (H-T8-7). It is pushed over `(tabs)`, so the
 * native back button would take its label from the previous route: the raw group name "(tabs)",
 * which VoiceOver read aloud. The arrow stays icon-only (`minimal`) and `headerBackTitle` gives the
 * accessible label a real, translated word.
 *
 * Compose: `NavigationIcon(contentDescription = stringResource(R.string.back))`. SwiftUI: the label of
 * the back `ToolbarItem`, or `.navigationBarBackButtonHidden` with your own `Button` and `accessibilityLabel`.
 */
export function notFoundScreenOptions({ title, back }: Readonly<{ title: string; back: string }>): NativeStackNavigationOptions {
  return {
    headerBackButtonDisplayMode: 'minimal',
    headerBackTitle: back,
    headerShown: true,
    title,
  };
}

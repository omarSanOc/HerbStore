import { Appearance } from 'react-native';

import { i18n } from '@/core/i18n';

import { createPreferencesListener } from './create-preferences-listener';

/**
 * The app wiring of the preferences listener. `i18n.changeLanguage` is called here and nowhere
 * else; `Appearance.setColorScheme` (RN 0.86: `'light' | 'dark' | 'unspecified'`) makes the NATIVE
 * parts follow the choice too: `Alert`, the keyboard, the status bar `auto` style and the system
 * sheets. On Android it is `AppCompatDelegate.setDefaultNightMode`; on iOS it sets
 * `overrideUserInterfaceStyle` on every window of the app.
 */
export const preferencesListenerMiddleware = createPreferencesListener({
  applyLanguage: (language) => {
    if (i18n.language !== language) void i18n.changeLanguage(language).catch(() => undefined);
  },
  applyColorScheme: (scheme) => Appearance.setColorScheme(scheme),
});

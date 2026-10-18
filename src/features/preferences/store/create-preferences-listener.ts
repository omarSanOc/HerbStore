import { createListenerMiddleware, type UnknownAction } from '@reduxjs/toolkit';
import { REHYDRATE } from 'redux-persist';

import type { SupportedLanguage } from '../../../core/i18n/languages.ts';
import { type Preferences, toNativeColorScheme } from '../logic/preferences.ts';

type StateWithPreferences = Readonly<{ preferences: Preferences }>;

type Ports = Readonly<{
  /** Makes the i18n instance speak `language`. Idempotent in the wiring. */
  applyLanguage: (language: SupportedLanguage) => void;
  /** Hands the appearance to the OS: `light`/`dark` force it, `unspecified` gives the control back. */
  applyColorScheme: (scheme: 'light' | 'dark' | 'unspecified') => void;
}>;

/** Whatever a port does (throw) is absorbed: the preference is already final in the store. */
function attempt(run: () => void): void {
  try {
    run();
  } catch {
    // The state is the source of truth; a failed side effect is retried on the next change or launch.
  }
}

/**
 * Applies the persisted preferences to the two things Redux does not own, AFTER the reducer has
 * accepted the action (spec 006, RF-8, RF-10):
 *
 * - After `REHYDRATE`: the language the user chose (if any) and a forced theme. The defaults apply
 *   nothing, because the app already starts in the device language (i18n is created synchronously)
 *   and the OS already rules the appearance, so a first launch never makes a native call.
 * - After a change of `preferences`: only the field that changed, so changing the currency never
 *   touches i18n or the appearance.
 *
 * The side effects are injected so the rule runs in Node with the real slice; the app wiring
 * (`preferences-listeners.ts`) passes `i18n.changeLanguage` and `Appearance.setColorScheme`.
 *
 * Compose: `AppCompatDelegate.setApplicationLocales` + `setDefaultNightMode` from a collector of the
 * DataStore flow in the app scope. SwiftUI: `.environment(\.locale)` + `overrideUserInterfaceStyle`
 * driven from an `@Observable` settings object.
 */
export function createPreferencesListener({ applyLanguage, applyColorScheme }: Ports) {
  const listener = createListenerMiddleware();

  listener.startListening({
    predicate: (action: UnknownAction, current, original): boolean =>
      action.type === REHYDRATE ||
      (current as StateWithPreferences).preferences !== (original as StateWithPreferences).preferences,
    effect: (action, listenerApi) => {
      const now = (listenerApi.getState() as StateWithPreferences).preferences;

      if (action.type === REHYDRATE) {
        if (now.language !== undefined) attempt(() => applyLanguage(now.language as SupportedLanguage));
        if (now.theme !== 'system') attempt(() => applyColorScheme(toNativeColorScheme(now.theme)));
        return;
      }

      const before = (listenerApi.getOriginalState() as StateWithPreferences).preferences;
      if (now.language !== undefined && now.language !== before.language) attempt(() => applyLanguage(now.language as SupportedLanguage));
      if (now.theme !== before.theme) attempt(() => applyColorScheme(toNativeColorScheme(now.theme)));
    },
  });

  return listener;
}

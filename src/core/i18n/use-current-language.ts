import { useSyncExternalStore } from 'react';

import { deviceLanguage, i18n } from './index';
import { isSupportedLanguage, type SupportedLanguage } from './languages';

/**
 * The effective language as a value, never as a mutable singleton: `i18n.language` at this moment,
 * reduced to the only two the app supports. Anything i18n could hold outside `es | en` (a
 * `languageTag` from a device, a code from a detector) falls back to the device language, which is
 * already an `es | en` value (`resolveDeviceLanguage`).
 *
 * This is the value every localized query takes as an ARGUMENT (RTK Query cache identity), so the
 * header sent, the `Content-Language` required and the entry rendered always describe the same
 * language (RF-22 to RF-24, RNF-3).
 */
function readLanguage(): SupportedLanguage {
  return isSupportedLanguage(i18n.language) ? i18n.language : deviceLanguage;
}

/** Re-render exactly when i18n announces a new language; nothing else can change this value. */
function subscribe(onChange: () => void): () => void {
  i18n.on('languageChanged', onChange);
  return () => i18n.off('languageChanged', onChange);
}

/**
 * The current `es | en` for hooks. React's external-store subscription (no state, no effect):
 * reading and subscribing are the same source, so two components can never disagree about the
 * language of the frame they are drawing.
 *
 * Compose: the equivalent of collecting a `StateFlow<Locale>` (`i18n` is the store). SwiftUI: a
 * `@Published var language` read from the `View`, or `.task(id: language)`.
 */
export function useCurrentLanguage(): SupportedLanguage {
  return useSyncExternalStore(subscribe, readLanguage, readLanguage);
}

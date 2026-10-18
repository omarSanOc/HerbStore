import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { resolveDeviceLanguage, supportedLanguages } from './languages';
import { en } from './resources/en';
import { es } from './resources/es';

export { supportedLanguages, type SupportedLanguage } from './languages';

/**
 * The language of the device. It is the language the app STARTS in, synchronously, so the first
 * frame is never blank and never needs a language to arrive. A language the user chose is applied
 * after the persisted preferences are rehydrated (`preferences-listeners.ts`); `i18n.changeLanguage`
 * is called there and nowhere else.
 */
export const deviceLanguage = resolveDeviceLanguage(getLocales()[0]?.languageCode);
const i18n = createInstance();

void i18n.use(initReactI18next).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'es',
  initAsync: false,
  interpolation: {
    escapeValue: false,
  },
  lng: deviceLanguage,
  resources: { en, es },
  supportedLngs: supportedLanguages,
});

export { i18n };

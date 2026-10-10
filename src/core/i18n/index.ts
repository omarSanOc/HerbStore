import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { en } from './resources/en';
import { es } from './resources/es';

export const supportedLanguages = ['es', 'en'] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

const deviceLanguage = getLocales()[0]?.languageCode;
const initialLanguage: SupportedLanguage = deviceLanguage === 'en' ? 'en' : 'es';
const i18n = createInstance();

void i18n.use(initReactI18next).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'es',
  initAsync: false,
  interpolation: {
    escapeValue: false,
  },
  lng: initialLanguage,
  resources: { en, es },
  supportedLngs: supportedLanguages,
});

export { i18n };

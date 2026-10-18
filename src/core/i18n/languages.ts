// The languages of the app and how a value is checked against them. Pure (no React Native, no
// i18next): `test:logic` runs it, and the persisted preferences (`persist-policy.ts`) import it.

export const supportedLanguages = ['es', 'en'] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

/** Strict guard for values that come from storage or from user code: the exact code, nothing else. */
export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return value === 'es' || value === 'en';
}

/** The device language as `expo-localization` reports it (`languageCode`): English or, for anything else, Spanish. */
export function resolveDeviceLanguage(languageCode: string | null | undefined): SupportedLanguage {
  return languageCode === 'en' ? 'en' : 'es';
}

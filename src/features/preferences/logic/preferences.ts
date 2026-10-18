// The user's preferences: language, currency and theme (spec 006, RF-8, RF-9, RF-10, RNF-3).
// Pure: no React Native, no i18next, so `test:logic` runs it and `persist-policy.ts` can restore it.
//
// - `language` is OPTIONAL: absent means "never chosen", and then the app speaks the device language.
//   The device language is never written as if it were a choice (a user who changes the system
//   language later would otherwise be stuck with the old one).
// - `currency` only changes the view (the canonical amounts are MXN cents, see `currency.ts`).
// - `theme` is `system` (follow the OS, also while the app is open), `light` or `dark`.
//
// Compose: a `data class Preferences` read from DataStore; SwiftUI: an `@AppStorage`-backed struct.

import { isSupportedLanguage, type SupportedLanguage } from '../../../core/i18n/languages.ts';
import { isRecord } from '../../../core/validation/json-guards.ts';
import type { CurrencyCode } from '../../product/contracts/catalog-product.ts';
import { isCurrencyCode } from './currency.ts';

export const themePreferences = ['system', 'light', 'dark'] as const;
export type ThemePreference = (typeof themePreferences)[number];

export type Preferences = Readonly<{
  language?: SupportedLanguage;
  currency: CurrencyCode;
  theme: ThemePreference;
}>;

export const DEFAULT_PREFERENCES: Preferences = { currency: 'MXN', theme: 'system' };

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

/** Own data property only: a stored object never gets to hand over a field through its prototype. */
function own(record: Record<string, unknown>, key: string): unknown {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

/**
 * A stored value -> valid preferences. Storage is outside the app's control, so every field is
 * judged alone: an invalid one takes its default (an invalid language becomes "absent") and the
 * valid ones stay. Anything that is not a plain object gives the defaults. Nothing but the three
 * preferences survives.
 */
export function restorePreferences(stored: unknown): Preferences {
  if (!isRecord(stored)) return DEFAULT_PREFERENCES;

  const language = own(stored, 'language');
  const currency = own(stored, 'currency');
  const theme = own(stored, 'theme');

  return {
    ...(isSupportedLanguage(language) ? { language } : {}),
    currency: isCurrencyCode(currency) ? currency : DEFAULT_PREFERENCES.currency,
    theme: isThemePreference(theme) ? theme : DEFAULT_PREFERENCES.theme,
  };
}

/** The scheme the UI draws: a forced theme wins; `system` follows what the OS reports (unknown = light). */
export function resolveColorScheme(
  theme: ThemePreference,
  system: 'light' | 'dark' | 'unspecified' | null | undefined,
): 'light' | 'dark' {
  if (theme !== 'system') return theme;
  return system === 'dark' ? 'dark' : 'light';
}

/** What `Appearance.setColorScheme` receives: `unspecified` hands the control back to the OS. */
export function toNativeColorScheme(theme: ThemePreference): 'light' | 'dark' | 'unspecified' {
  return theme === 'system' ? 'unspecified' : theme;
}

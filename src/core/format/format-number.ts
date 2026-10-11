/**
 * Locale-aware number formatting built on `Intl.NumberFormat` (available in Hermes on Android and
 * iOS). Pure: it receives the interface language and returns text, so it runs in Node tests.
 *
 * Money is never computed here or anywhere in the app with floating point arithmetic: the server
 * sends final prices and the formatter only rounds them to cents for display.
 */

/**
 * The interface language ('es' | 'en') is not a full locale. Regional variants matter for money:
 * `es-MX` writes MXN as `$277.90` and disambiguates USD as `USD 11.99` (plain `es` would use the
 * Spanish convention `277,90 MXN`), and `en-US` writes `$11.99` and `MX$277.90`. HerbStore is a
 * Mexican-peso store with dollar prices, so the Mexican variant is the natural Spanish one.
 */
export function resolveFormatLocale(language: string): string {
  return language.toLowerCase().startsWith('en') ? 'en-US' : 'es-MX';
}

// Building an `Intl.NumberFormat` is the expensive part (it loads locale data); `format` is cheap.
// One instance per (locale, options) is reused instead of one per card on every render.
const formatters = new Map<string, Intl.NumberFormat>();

function formatterFor(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = formatters.get(key);
  if (formatter === undefined) {
    formatter = new Intl.NumberFormat(locale, options);
    formatters.set(key, formatter);
  }
  return formatter;
}

/** `277.9` + `MXN` + `es` -> `$277.90`. The currency comes from the product, never the language. */
export function formatCurrency(amount: number, currency: string, language: string): string {
  return formatterFor(resolveFormatLocale(language), { style: 'currency', currency }).format(amount);
}

/** Rating with exactly one decimal: `4.9`, `3.0`. */
export function formatRating(rating: number, language: string): string {
  return formatterFor(resolveFormatLocale(language), {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(rating);
}

/** Whole number with grouping: `2400` -> `2,400`. */
export function formatInteger(value: number, language: string): string {
  return formatterFor(resolveFormatLocale(language), { maximumFractionDigits: 0 }).format(value);
}

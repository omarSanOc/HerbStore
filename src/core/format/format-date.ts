/**
 * Locale-aware date formatting built on `Intl.DateTimeFormat` (Hermes provides it on Android and
 * iOS). Pure: it receives the interface language and returns text, so it runs in Node tests.
 *
 * Only component options are used (`year`, `month`, `day`, `hour`, `minute`), the most widely
 * supported set of `Intl.DateTimeFormat`; `dateStyle`/`timeStyle` are not relied on.
 *
 * Compose: `DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM, FormatStyle.SHORT)`.
 * SwiftUI: `Text(date, format: .dateTime.day().month().year().hour().minute())`.
 */

import { resolveFormatLocale } from './format-number.ts';

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(locale: string, timeZone: string | undefined): Intl.DateTimeFormat {
  const key = `${locale}|${timeZone ?? ''}`;
  let formatter = formatters.get(key);
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      ...(timeZone === undefined ? {} : { timeZone }),
    });
    formatters.set(key, formatter);
  }
  return formatter;
}

/**
 * An ISO-8601 instant (what the server sends) -> "15 oct 2026, 10:30" for the interface language,
 * or `undefined` when the text is not a date (a stored value can be anything). `timeZone` is for
 * tests; the app leaves it out and shows the device's local time.
 */
export function formatDateTime(
  value: string,
  language: string,
  { timeZone }: Readonly<{ timeZone?: string }> = {},
): string | undefined {
  if (typeof value !== 'string' || value === '') return undefined;
  const time = Date.parse(value);
  if (Number.isNaN(time)) return undefined;
  return formatterFor(resolveFormatLocale(language), timeZone).format(time);
}

// "My orders" view model (spec 006, RF-11). Pure: no React Native, so `test:logic` runs it.
//
// The input is the persisted `orderHistory` (confirmed summaries of THIS installation, sanitized
// by `sanitizeOrderSummary`: id, lines, amounts and date, never an address). The output is what the
// screen draws, built FIELD BY FIELD so nothing that slipped into a stored object can reach the UI.
// Amounts keep their canonical value: only the VIEW converts to the preferred currency, through the
// same functions as the cart (`toDisplayCents`, centavos MXN canónicos).
//
// Compose: a `map` from the Room entity to a UI model in the ViewModel. SwiftUI: a computed property
// over the SwiftData `@Query` result.

import { formatDateTime } from '../../../core/format/format-date.ts';
import type { CurrencyCode, OrderSummary } from '../../checkout/contracts/order.ts';
import { formatMoney, toDisplayCents, toMxnCents } from '../../preferences/logic/currency.ts';

export type OrderRowModel = Readonly<{
  id: string;
  /** Local date and time in the interface language; `undefined` when the stored date is unreadable. */
  dateText: string | undefined;
  /** Whole units across all lines. */
  unitCount: number;
  /** The total in `displayCurrency`, written for the interface language. */
  totalText: string;
  displayCurrency: CurrencyCode;
  /** The total as canonical whole MXN cents: the same whatever currency is displayed. */
  canonicalMxnCents: number;
}>;

type ViewOptions = Readonly<{
  /** The preferred currency (`preferences.currency`). */
  currency: CurrencyCode;
  /** The interface language. */
  language: string;
  /** For tests; the app shows the device's local time. */
  timeZone?: string;
}>;

/** A positive whole number, or 0: a stored line can hold anything. */
function validQuantity(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : 0;
}

/** Milliseconds of a stored date, or `-Infinity` for text that is not a date (it sorts last). */
function instantOf(createdAt: string): number {
  const time = typeof createdAt === 'string' ? Date.parse(createdAt) : Number.NaN;
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}

/**
 * Newest first. The key is the instant the server gave (so an offset date and a `Z` date compare by
 * the moment they name); a tie, or two unreadable dates, keep "recorded later first" because the
 * history is appended in confirmation order. Unreadable dates sort after every dated order, so
 * the comparator stays a total order.
 */
export function buildOrderHistoryRows(orders: readonly OrderSummary[], options: ViewOptions): OrderRowModel[] {
  const { currency, language, timeZone } = options;

  return orders
    .map((order, index) => ({ order, index, instant: instantOf(order.createdAt) }))
    .sort((a, b) => (a.instant === b.instant ? b.index - a.index : a.instant < b.instant ? 1 : -1))
    .map(({ order }): OrderRowModel => ({
      id: order.id,
      dateText: formatDateTime(order.createdAt, language, { timeZone }),
      unitCount: order.items.reduce((sum, line) => sum + validQuantity(line.quantity), 0),
      totalText: formatMoney(toDisplayCents(order.total, order.currency, currency), currency, language),
      displayCurrency: currency,
      canonicalMxnCents: toMxnCents(order.total, order.currency),
    }));
}

// Money and currency conversion (spec 004, RF-5, RF-13). Pure: no React Native, so `test:logic`
// runs it.
//
// The CANONICAL value of any amount is a whole number of MXN cents. Every sum and comparison in the
// app happens on that integer (a float could miss "exactly 800 MXN" by a millionth); the preferred
// currency only changes the VIEW, and `Intl.NumberFormat` is the very last step. A price keeps the
// currency it came with from the catalog (`unitPrice` + `currency` in the cart line); the
// conversion to the view never rewrites it.

import { formatCurrency } from '../../../core/format/format-number.ts';
import type { CurrencyCode } from '../../product/contracts/catalog-product.ts';

/** Fixed rate of the spec: 1 USD = 18 MXN. */
export const MXN_PER_USD = 18;

/** Free shipping starts at 800 MXN, in canonical cents; exactly 800 qualifies. */
export const FREE_SHIPPING_THRESHOLD_MXN_CENTS = 80_000;

/** Strict guard for values that come from storage or from user code: exact code, nothing else. */
export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return value === 'MXN' || value === 'USD';
}

/**
 * An amount in its own currency (`277.9` MXN, `11.99` USD) -> canonical whole MXN cents.
 * The decimal amount is first taken to whole cents of its own currency (rounding absorbs the
 * float noise of `1.15 * 100`) and a USD cent is worth 18 MXN cents, so USD is exact.
 * Precondition: a finite, non-negative amount (validated where it enters: the catalog parser and
 * the cart line guard).
 */
export function toMxnCents(amount: number, currency: CurrencyCode): number {
  const ownCents = Math.round(amount * 100);
  return currency === 'USD' ? ownCents * MXN_PER_USD : ownCents;
}

/**
 * Canonical MXN cents -> whole cents of the view currency. MXN is the identity; USD divides by 18
 * and rounds HALF UP to the cent (9 MXN cents = exactly half a USD cent goes up to 1).
 */
export function fromMxnCents(mxnCents: number, currency: CurrencyCode): number {
  if (currency === 'MXN') {
    return mxnCents;
  }
  return Math.floor((mxnCents + MXN_PER_USD / 2) / MXN_PER_USD);
}

/**
 * An amount in its own currency -> whole cents of the preferred (view) currency, through the
 * canonical value. The same currency is not converted at all, so MXN -> MXN never rounds.
 */
export function toDisplayCents(
  amount: number,
  from: CurrencyCode,
  display: CurrencyCode,
): number {
  return from === display ? Math.round(amount * 100) : fromMxnCents(toMxnCents(amount, from), display);
}

/** Whole cents of a currency -> text for the interface language (`Intl.NumberFormat`). */
export function formatMoney(cents: number, currency: CurrencyCode, language: string): string {
  return formatCurrency(cents / 100, currency, language);
}

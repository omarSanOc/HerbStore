// Selectors of the cart (spec 004, RF-7, RF-10, RF-11, RF-13). Pure functions of the state, no
// React Native: `test:logic` runs them with a hand-made state.
//
// The store keeps the MINIMUM (the lines and the preferred currency); everything else is derived
// here on read: units, canonical subtotal, the figure in the preferred currency and the progress
// to free shipping. Keeping "units" or "subtotal" as state too would create two truths that can
// drift apart.
//
// Only the selectors that RETURN AN OBJECT use `createSelector`: `useSelector` compares with
// `Object.is`, so a selector that builds a new object on every call re-renders its component on
// every store update (and react-redux warns about it in development). Selectors that return a
// number or the same array reference need no memoization.
//
// Compose: `StateFlow.map { }.distinctUntilChanged()` / `derivedStateOf`; SwiftUI: a computed
// property of an `@Observable` model.

import { createSelector } from '@reduxjs/toolkit';

import type { RootState } from '@/core/store/store';

import { selectIsRehydrated } from '../../../core/store/rehydration.ts';
import {
  FREE_SHIPPING_THRESHOLD_MXN_CENTS,
  fromMxnCents,
  toMxnCents,
} from '../../preferences/logic/currency.ts';
import { selectPreferredCurrency } from '../../preferences/store/preferences-slice.ts';
import type { CurrencyCode } from '../../product/contracts/catalog-product.ts';
import { cartSubtotalMxnCents, cartUnits, type CartLine, type CartLines } from './cart.ts';

type CartState = Pick<RootState, 'cart'>;

export const selectCartLines = (state: CartState): CartLines => state.cart.lines;

/** Units across all lines: what the tab badge shows. */
export const selectCartUnits = (state: CartState): number => cartUnits(state.cart.lines);

/** The canonical subtotal in whole MXN cents. It never depends on the preferred currency. */
export const selectSubtotalMxnCents = (state: CartState): number =>
  cartSubtotalMxnCents(state.cart.lines);

/**
 * `true` while the cart must not be changed. On T2 that is only the rehydration (a change made
 * before redux-persist restores the slice would win over what was stored); T8 adds the
 * `preliminary`/`unresolved` checkout attempt. Every change to the cart asks this BEFORE
 * dispatching.
 */
export const selectIsCartLocked = (state: Pick<RootState, '_persist'>): boolean =>
  !selectIsRehydrated(state) || ('checkoutAttempt' in state && (state as Pick<RootState, '_persist' | 'checkoutAttempt'>).checkoutAttempt.status !== 'idle');

/** A non-empty, restored, unlocked cart can go to checkout. */
export const selectCanCheckout = (state: CartState & Pick<RootState, '_persist'> & Partial<Pick<RootState, 'checkoutAttempt'>>): boolean =>
  state.cart.lines.length > 0 && !selectIsCartLocked(state);

export type DisplaySubtotal = Readonly<{
  /** Whole cents of `currency`, the view value (USD rounds half up). */
  cents: number;
  currency: CurrencyCode;
}>;

/** The subtotal in the preferred currency, ready for `formatMoney`. */
export const selectDisplaySubtotal = createSelector(
  [selectSubtotalMxnCents, selectPreferredCurrency],
  (mxnCents, currency): DisplaySubtotal => ({ cents: fromMxnCents(mxnCents, currency), currency }),
);

export type DisplayCartLine = Readonly<{
  /** The persisted product snapshot; display amounts below are derived and never stored. */
  line: CartLine;
  unitCents: number;
  totalCents: number;
  currency: CurrencyCode;
}>;

/** Unit and complete-line amounts in the preferred currency, derived from canonical MXN cents. */
export const selectDisplayCartLines = createSelector(
  [selectCartLines, selectPreferredCurrency],
  (lines, currency): readonly DisplayCartLine[] =>
    lines.map((line) => {
      const unitMxnCents = toMxnCents(line.unitPrice, line.currency);
      return {
        line,
        unitCents: fromMxnCents(unitMxnCents, currency),
        // Convert the complete line, not a rounded display unit multiplied by quantity.
        totalCents: fromMxnCents(unitMxnCents * line.quantity, currency),
        currency,
      };
    }),
);

export type ShippingProgress = Readonly<{
  /** Decided by the canonical MXN subtotal, never by the rounded view. 800.00 MXN qualifies. */
  qualifies: boolean;
  /** 0..1 of the canonical threshold. */
  fraction: number;
  /** The threshold, in whole cents of `currency`. */
  thresholdCents: number;
  /** What is missing, in whole cents of `currency`: 0 once it qualifies, otherwise at least 1. */
  remainingCents: number;
  currency: CurrencyCode;
}>;

/**
 * Progress towards free shipping. `qualifies` and `fraction` come from the canonical value, so
 * 799.99 MXN does not qualify and 800.00 does in either view. The figures are converted for the
 * view, and the remainder is clamped to one cent while the threshold is not met: in USD a gap of a
 * single MXN cent rounds to 0 and the screen would read "$0.00 left" without having qualified.
 */
export const selectShippingProgress = createSelector(
  [selectSubtotalMxnCents, selectPreferredCurrency],
  (subtotalMxnCents, currency): ShippingProgress => {
    const qualifies = subtotalMxnCents >= FREE_SHIPPING_THRESHOLD_MXN_CENTS;
    const missingMxnCents = Math.max(0, FREE_SHIPPING_THRESHOLD_MXN_CENTS - subtotalMxnCents);

    return {
      qualifies,
      fraction: Math.min(1, subtotalMxnCents / FREE_SHIPPING_THRESHOLD_MXN_CENTS),
      thresholdCents: fromMxnCents(FREE_SHIPPING_THRESHOLD_MXN_CENTS, currency),
      remainingCents: qualifies ? 0 : Math.max(1, fromMxnCents(missingMxnCents, currency)),
      currency,
    };
  },
);

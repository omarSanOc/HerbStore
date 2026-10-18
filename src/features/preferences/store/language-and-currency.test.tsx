/// <reference types="jest" />
// RF-3 (T2). Language and currency change independently and can change TOGETHER (the user taps
// both quickly, or Day 6's account screen applies both). The rules under test:
//   1. the final preference of each axis is the LAST one requested, whatever the interleaving;
//   2. the canonical value (whole MXN cents in the cart) never changes;
//   3. what the user reads is a consistent pair: the text of the language AND the amount of the
//      currency, never a mix of old and new.
// The pure matrix 2 x 2 is in `currency.test.ts`; this file covers the store + i18n + UI wiring.
//
// `.tsx` because i18n (`expo-localization`) and the theme need the Jest React Native environment.
//
// Compose: `AppCompatDelegate.setApplicationLocales` + a `StateFlow<Currency>` collected together.
// SwiftUI: `.environment(\.locale, ...)` + an `@Observable` settings object read in the same body.
import { act, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { i18n } from '@/core/i18n';
import { useAppSelector } from '@/core/store/hooks';
import { selectDisplaySubtotal, selectShippingProgress, selectSubtotalMxnCents } from '@/features/cart/logic/cart-selectors';
import { formatMoney } from '@/features/preferences/logic/currency';
import { productAdded } from '@/features/cart/store/cart-slice';

import { createTestStore } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render-with-providers';

import { currencyChanged, selectPreferredCurrency } from './preferences-slice';

// 2 x 277.90 MXN + 1 x 11.99 USD (= 215.82 MXN) = 771.62 MXN: under the free-shipping threshold.
const MXN_PRODUCT = { productId: 'product-261009-001', name: 'Powder 001', unitPrice: 277.9, currency: 'MXN' as const, stock: 9 };
const USD_PRODUCT = { productId: 'product-261009-002', name: 'Powder 002', unitPrice: 11.99, currency: 'USD' as const, stock: 9 };
const CANONICAL_MXN_CENTS = 77_162;

const plain = (text: string) => text.replace(/[  ]/g, ' ');

function seededStore() {
  const store = createTestStore();
  store.dispatch(productAdded({ product: MXN_PRODUCT, quantity: 2 }));
  store.dispatch(productAdded({ product: USD_PRODUCT, quantity: 1 }));
  return store;
}

/** What a cart header would show: translated label + subtotal in the preferred currency. */
function SubtotalProbe() {
  const { t, i18n: instance } = useTranslation();
  const display = useAppSelector(selectDisplaySubtotal);
  const progress = useAppSelector(selectShippingProgress);
  return (
    <>
      <Text>{t('cart.line.subtotal', { amount: formatMoney(display.cents, display.currency, instance.language) })}</Text>
      <Text>{`${instance.language} ${display.currency} threshold:${progress.qualifies ? 'yes' : 'no'}`}</Text>
    </>
  );
}

describe('changing language and currency at the same time', () => {
  it('starts in Spanish and MXN with the canonical subtotal', async () => {
    const store = seededStore();
    await renderWithProviders(<SubtotalProbe />, { store });

    expect(plain(screen.getByText(/^Subtotal:/).props.children)).toBe('Subtotal: $771.62');
    expect(selectSubtotalMxnCents(store.getState())).toBe(CANONICAL_MXN_CENTS);
  });

  it('applying both in one go shows English text with USD amounts, and the canonical value is untouched', async () => {
    const store = seededStore();
    await renderWithProviders(<SubtotalProbe />, { store });

    await act(async () => {
      await Promise.all([i18n.changeLanguage('en'), Promise.resolve(store.dispatch(currencyChanged('USD')))]);
    });

    // 77162 MXN cents / 18 = 4286.78 -> 4287 USD cents.
    expect(plain(screen.getByText(/^Subtotal:/).props.children)).toBe('Subtotal: $42.87');
    expect(screen.getByText('en USD threshold:no')).toBeOnTheScreen();
    expect(selectPreferredCurrency(store.getState())).toBe('USD');
    expect(i18n.language).toBe('en');
    expect(selectSubtotalMxnCents(store.getState())).toBe(CANONICAL_MXN_CENTS);
    expect(store.getState().cart.lines).toHaveLength(2);
  });

  it.each([
    { name: 'language first', order: ['language', 'currency'] },
    { name: 'currency first', order: ['currency', 'language'] },
  ])('$name: the same final text and amount', async ({ order }) => {
    const store = seededStore();
    await renderWithProviders(<SubtotalProbe />, { store });

    await act(async () => {
      for (const axis of order) {
        if (axis === 'language') await i18n.changeLanguage('en');
        else store.dispatch(currencyChanged('USD'));
      }
    });

    expect(plain(screen.getByText(/^Subtotal:/).props.children)).toBe('Subtotal: $42.87');
    expect(selectSubtotalMxnCents(store.getState())).toBe(CANONICAL_MXN_CENTS);
  });

  it('rapid toggling ends with the LAST preference of each axis, and no drift in the canonical value', async () => {
    const store = seededStore();
    await renderWithProviders(<SubtotalProbe />, { store });

    await act(async () => {
      const languages = ['en', 'es', 'en', 'es', 'en'] as const;
      const currencies = ['USD', 'MXN', 'USD', 'MXN', 'USD', 'MXN'] as const;
      const pending: Promise<unknown>[] = [];
      for (let i = 0; i < Math.max(languages.length, currencies.length); i += 1) {
        if (languages[i] !== undefined) pending.push(i18n.changeLanguage(languages[i]));
        if (currencies[i] !== undefined) store.dispatch(currencyChanged(currencies[i] as 'USD' | 'MXN'));
      }
      await Promise.all(pending);
    });

    expect(i18n.language).toBe('en'); // last language requested
    expect(selectPreferredCurrency(store.getState())).toBe('MXN'); // last currency requested
    expect(plain(screen.getByText(/^Subtotal:/).props.children)).toBe('Subtotal: MX$771.62'); // en + MXN
    expect(selectSubtotalMxnCents(store.getState())).toBe(CANONICAL_MXN_CENTS);
  });

  it('the free-shipping verdict does not depend on the pair: it stays "no" in all four combinations', async () => {
    const store = seededStore();
    await renderWithProviders(<SubtotalProbe />, { store });

    for (const language of ['es', 'en'] as const) {
      for (const currency of ['MXN', 'USD'] as const) {
        await act(async () => {
          await i18n.changeLanguage(language);
          store.dispatch(currencyChanged(currency));
        });
        expect(screen.getByText(`${language} ${currency} threshold:no`)).toBeOnTheScreen();
      }
    }
  });

  it('crossing the threshold while language and currency change reports it in the new pair', async () => {
    const store = seededStore();
    await renderWithProviders(<SubtotalProbe />, { store });

    // One more MXN unit: 771.62 + 277.90 = 1049.52 MXN, above 800.
    await act(async () => {
      store.dispatch(productAdded({ product: MXN_PRODUCT, quantity: 1 }));
      await i18n.changeLanguage('en');
      store.dispatch(currencyChanged('USD'));
    });

    expect(screen.getByText('en USD threshold:yes')).toBeOnTheScreen();
    expect(selectSubtotalMxnCents(store.getState())).toBe(CANONICAL_MXN_CENTS + 27_790);
  });
});

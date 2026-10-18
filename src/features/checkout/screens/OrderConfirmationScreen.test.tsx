/// <reference types="jest" />
// RF-7 (T4b), H-T8-8. The confirmation names each line with its quantity: "1 unidad", "2 unidades"
// (it said "1 unidades"). The text comes from plural forms of the language, chosen by i18next with
// `Intl.PluralRules`.
//
// Compose/Android: `pluralStringResource(R.plurals.units, n, n)`. SwiftUI: a String Catalog entry
// with "Vary by Plural" and `Text("\(n) units")`.
import { act, fireEvent, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { FOCUS_ON_MOUNT_DELAY_MS } from '@/core/accessibility/use-focus-on-mount';

import { fontScaleLimits } from '@/design-system';
import { notificationUnusable, orderRecorded } from '@/features/orders/store/order-history-slice';
import { createMemoryStorage, createTestStore } from '@/test/fixtures';
import { resetRouterMock, router } from '@/test/mock-expo-router';
import { renderWithProviders } from '@/test/render-with-providers';

import { OrderConfirmationScreen } from './OrderConfirmationScreen';

jest.mock('expo-router', () => jest.requireActual('@/test/mock-expo-router').expoRouterModule);

type Language = 'es' | 'en';

const TEXT = {
  es: { title: 'Pedido confirmado', order: 'Pedido order-0001', one: '1 unidad', many: (n: number) => `${n} unidades`, done: 'Volver al carrito' },
  en: { title: 'Order confirmed', order: 'Order order-0001', one: '1 unit', many: (n: number) => `${n} units`, done: 'Back to cart' },
} as const;

const summary = (quantities: readonly number[]) => ({
  id: 'order-0001',
  items: quantities.map((quantity, index) => ({ productId: `product-261009-00${index + 1}`, quantity, unitPrice: 100, lineTotal: 100 * quantity })),
  currency: 'MXN' as const,
  subtotal: 100,
  shipping: 0,
  total: 100,
  createdAt: '2026-10-15T10:00:00.000Z',
});

beforeEach(() => {
  resetRouterMock();
});

describe.each<Language>(['es', 'en'])('OrderConfirmationScreen in %s', (language) => {
  const text = TEXT[language];

  it('writes one unit in the singular and the rest in the plural, one line per product', async () => {
    const store = createTestStore();
    store.dispatch(orderRecorded(summary([1, 2, 99])));
    await renderWithProviders(<OrderConfirmationScreen />, { store, language });

    expect(screen.getByRole('header', { name: text.title })).toBeOnTheScreen();
    expect(screen.getByText(text.order)).toBeOnTheScreen();
    expect(screen.getByText(text.one)).toBeOnTheScreen();
    expect(screen.getByText(text.many(2))).toBeOnTheScreen();
    expect(screen.getByText(text.many(99))).toBeOnTheScreen();
    expect(screen.queryByText(language === 'es' ? '1 unidades' : '1 units')).not.toBeOnTheScreen();
  });

  // T6a. The confirmation replaces the checkout (or the status screen), whose focused button is
  // gone: the reader goes to the title, not to whatever the platform finds first (the "Home" tab).
  it('moves the screen-reader focus to its title once it is mounted', async () => {
    jest.useFakeTimers();
    const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
    focus.mockClear();
    const store = createTestStore();
    store.dispatch(orderRecorded(summary([1])));
    await renderWithProviders(<OrderConfirmationScreen />, { store, language });

    await act(async () => {
      await jest.advanceTimersByTimeAsync(FOCUS_ON_MOUNT_DELAY_MS + 10);
    });

    expect(focus).toHaveBeenCalledTimes(1);
    const target = focus.mock.calls[0]?.[0] as { props?: { children?: unknown } };
    expect(target.props?.children).toBe(text.title);
  });

  it('returns to the cart', async () => {
    const store = createTestStore();
    store.dispatch(orderRecorded(summary([1])));
    await renderWithProviders(<OrderConfirmationScreen />, { store, language });

    await fireEvent.press(screen.getByRole('button', { name: text.done }));

    expect(router.dismissTo).toHaveBeenCalledWith('/(tabs)/(cart)/cart');
  });
});

// RF-15 (T6b, H-T8-6). "Abrir ajustes de notificaciones" has a 14-letter word that iOS AX5 split in the
// middle ("notificacione / s") inside its 370 pt button. The two buttons of the notice scale only up to
// `fontScaleLimits.actionLabel` (2.0, the largest scale Android offers).
describe('OrderConfirmationScreen: the notification actions at a large font', () => {
  it.each<[Language, string, string]>([
    ['es', 'Abrir ajustes de notificaciones', 'Reintentar notificación'],
    ['en', 'Open notification settings', 'Try notification again'],
  ])('caps the font scale of the settings and retry buttons in %s', async (language, settings, retry) => {
    const seed = createTestStore();
    seed.dispatch(orderRecorded(summary([1])));
    seed.dispatch(notificationUnusable({ orderId: 'order-0001', canOpenSettings: true, reason: 'blocked' }));
    const store = createTestStore({
      storage: createMemoryStorage({ holdReads: true }),
      preloadedState: seed.getState(),
    });
    await renderWithProviders(<OrderConfirmationScreen />, { store, language });

    for (const name of [settings, retry]) {
      expect(await screen.findByRole('button', { name })).toBeOnTheScreen();
      expect(await screen.findByText(name)).toHaveProp('maxFontSizeMultiplier', fontScaleLimits.actionLabel);
    }
    // The cap is the largest Android scale: it never lowers what an Android user already gets.
    expect(fontScaleLimits.actionLabel).toBe(2);
  });
});

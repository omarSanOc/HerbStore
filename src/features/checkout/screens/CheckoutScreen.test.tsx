/// <reference types="jest" />
// RF-4 (T3a), RF-17 (T3b). The delivery-address form as the user lives it: what the screen says when the data is
// wrong (validation), that nothing is sent until it is right, that a double tap sends ONE order, and
// that the address never reaches the store. Fields are found by their accessible name (the label a
// screen reader speaks), messages by their text, buttons by role.
//
// Compose: `onNodeWithContentDescription("Phone").performTextInput("…")` and
// `onNodeWithText("Continue").performClick()`. XCUITest: `app.textFields["Phone"].typeText("…")`.
import { act, fireEvent, isHiddenFromAccessibility, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { productAdded } from '@/features/cart/store/cart-slice';
import { languageChanged } from '@/features/preferences/store/preferences-slice';
import { createTestStore, startPersistence, wireProduct } from '@/test/fixtures';
import { createMockFetch, reply } from '@/test/mock-fetch';
import { resetRouterMock, router } from '@/test/mock-expo-router';
import { renderWithProviders } from '@/test/render-with-providers';

import { CheckoutScreen } from './CheckoutScreen';

jest.mock('expo-router', () => jest.requireActual('@/test/mock-expo-router').expoRouterModule);

// `expo-crypto` is native. A distinct key per attempt, like the real UUIDs; the `mock` prefix lets the
// hoisted factory read the counter.
let mockKeyCounter = 0;
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  randomUUID: jest.fn(() => `key-${String(++mockKeyCounter).padStart(4, '0')}`),
  digestStringAsync: jest.fn(async (_algorithm: string, value: string) => `digest-${value.length}`),
}));

type Language = 'es' | 'en';

const TEXT = {
  es: {
    submit: 'Continuar',
    // Plural form of the language (T4b, RF-7): "1 error", "7 errores".
    summary: (n: number) => (n === 1 ? 'Revisa 1 error del formulario.' : `Revisa ${n} errores del formulario.`),
    serverField: 'Revisa este dato.',
    serverGeneral: 'No se pudieron validar los datos. Revisa el formulario.',
    outOfStock: 'Algunos productos ya no tienen suficiente stock. Revisa tu carrito, ajusta o retira las líneas y vuelve a intentarlo.',
    adjusted: (name: string, now: number, before: number) => `${name}: ahora ${now} (antes ${before}).`,
    removed: (name: string) => `${name}: se agotó y se quitó del carrito.`,
    labels: {
      fullName: 'Nombre completo',
      phone: 'Teléfono',
      postalCode: 'Código postal',
      state: 'Estado',
      city: 'Ciudad',
      street: 'Calle',
      exteriorNumber: 'Número exterior',
      interiorNumber: 'Número interior (opcional)',
    },
    errors: {
      fullName: 'El nombre debe tener al menos 3 caracteres.',
      phone: 'El teléfono debe tener exactamente 10 dígitos.',
      postalCode: 'El código postal debe tener exactamente 5 dígitos.',
      exteriorNumber: 'El número exterior es obligatorio.',
    },
  },
  en: {
    submit: 'Continue',
    summary: (n: number) => (n === 1 ? 'Review 1 form error.' : `Review ${n} form errors.`),
    serverField: 'Review this value.',
    serverGeneral: 'The details could not be validated. Review the form.',
    outOfStock: 'Some products no longer have enough stock. Check your cart, adjust or remove the lines and try again.',
    adjusted: (name: string, now: number, before: number) => `${name}: now ${now} (was ${before}).`,
    removed: (name: string) => `${name}: sold out and removed from your cart.`,
    labels: {
      fullName: 'Full name',
      phone: 'Phone',
      postalCode: 'Postal code',
      state: 'State',
      city: 'City',
      street: 'Street',
      exteriorNumber: 'Exterior number',
      interiorNumber: 'Interior number (optional)',
    },
    errors: {
      fullName: 'The name must have at least 3 characters.',
      phone: 'The phone must have exactly 10 digits.',
      postalCode: 'The postal code must have exactly 5 digits.',
      exteriorNumber: 'The exterior number is required.',
    },
  },
} as const;

const VALID = {
  fullName: 'Ana Perez',
  phone: '5512345678',
  postalCode: '01234',
  state: 'Jalisco',
  city: 'Guadalajara',
  street: 'Avenida Central',
  exteriorNumber: '10',
} as const;

const PRODUCT = {
  productId: 'product-261009-001',
  name: 'Complete Daily Powder 001',
  unitPrice: 100,
  currency: 'MXN' as const,
  stock: 5,
};

const CONFIRMED = reply.success({
  status: 'confirmed',
  order: {
    id: 'order-0001',
    items: [{ productId: PRODUCT.productId, quantity: 2, unitPrice: 100, lineTotal: 200 }],
    currency: 'MXN',
    subtotal: 200,
    shipping: 99,
    total: 299,
    createdAt: '2026-10-15T10:00:00.000Z',
  },
});

const advance = (ms: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });

describe('CheckoutScreen address form', () => {
  let mock: ReturnType<typeof createMockFetch>;
  let store: ReturnType<typeof createTestStore>;

  beforeEach(async () => {
    mockKeyCounter = 0;
    jest.useFakeTimers();
    resetRouterMock();
    mock = createMockFetch();
    mock.install();
    store = createTestStore();
    await startPersistence(store).rehydrated;
    store.dispatch(productAdded({ product: PRODUCT, quantity: 2 }));
  });

  afterEach(() => {
    mock.uninstall();
  });

  const posts = () => mock.calls.filter(({ method }) => method === 'POST');

  const fill = async (language: Language, values: Partial<Record<keyof typeof VALID, string>>) => {
    const labels = TEXT[language].labels;
    for (const [field, value] of Object.entries(values) as [keyof typeof VALID, string][]) {
      await fireEvent.changeText(screen.getByLabelText(labels[field]), value);
    }
  };

  const submit = async (language: Language) => {
    await fireEvent.press(screen.getByRole('button', { name: TEXT[language].submit }));
    await advance(10);
  };

  describe.each<Language>(['es', 'en'])('in %s', (language) => {
    const text = TEXT[language];

    it('shows every field with an accessible name, and the optional one says so', async () => {
      await renderWithProviders(<CheckoutScreen />, { store, language });

      for (const label of Object.values(text.labels)) {
        expect(screen.getByLabelText(label)).toBeOnTheScreen();
      }
      expect(screen.getByRole('button', { name: text.submit })).toBeOnTheScreen();
    });

    it('T5: each field has the stable id the Maestro flow types into, the same element as its accessible name', async () => {
      await renderWithProviders(<CheckoutScreen />, { store, language });

      // `testID` is `resource-id` on Android and `accessibilityIdentifier` on iOS: it does not change with the language.
      for (const [field, label] of Object.entries(text.labels)) {
        expect(screen.getByTestId(`checkout-${field}`)).toBe(screen.getByLabelText(label));
      }
    });

    it('H-N5: the visible label is hidden from the screen reader, so the field name is read once', async () => {
      await renderWithProviders(<CheckoutScreen />, { store, language });

      for (const [field, label] of Object.entries(text.labels)) {
        // The field is still reachable by its accessible name and by its stable id...
        const input = screen.getByLabelText(label);
        expect(input).toBe(screen.getByTestId(`checkout-${field}`));
        expect(isHiddenFromAccessibility(input)).toBe(false);
        // ...the label the sighted user reads is still on the screen, but it is no accessibility stop of its own.
        const visibleLabel = screen.getByText(label, { includeHiddenElements: true });
        expect(visibleLabel).toBeOnTheScreen();
        expect(isHiddenFromAccessibility(visibleLabel)).toBe(true);
        expect(screen.queryByText(label)).toBeNull();
        // `aria-hidden` is the one prop RN 0.86 maps to BOTH platforms' flags (`accessibilityElementsHidden` on iOS,
        // `importantForAccessibility="no-hide-descendants"` on Android); the jest mock of Text keeps it as written.
        expect(visibleLabel.props['aria-hidden']).toBe(true);
      }
    });

    it('H-N5: the error message of a field stays accessible and is still announced', async () => {
      const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
      announce.mockClear();
      await renderWithProviders(<CheckoutScreen />, { store, language });

      await submit(language);

      for (const message of Object.values(text.errors)) {
        const error = screen.getByText(message);
        expect(isHiddenFromAccessibility(error)).toBe(false);
        expect(error.props.accessibilityLiveRegion).toBe('polite');
      }
      expect(screen.getByRole('alert')).toHaveAccessibleName(new RegExp(text.summary(7)));
      expect(announce).toHaveBeenCalledTimes(1);
    });

    it.each(['light', 'dark'] as const)('RF-10: in the %s theme every field asks the system keyboard for that appearance', async (colorScheme) => {
      await renderWithProviders(<CheckoutScreen />, { store, language, colorScheme });

      for (const label of Object.values(text.labels)) {
        expect(screen.getByLabelText(label).props.keyboardAppearance).toBe(colorScheme);
      }
    });

    it('VALIDATION: an empty form sends nothing, summarises the errors and explains each field', async () => {
      // jest-expo already mocks `AccessibilityInfo`: calls from earlier tests must not leak in.
      const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
      announce.mockClear();
      await renderWithProviders(<CheckoutScreen />, { store, language });

      await submit(language);

      // 7 required fields are empty; the optional interior number is not an error.
      expect(screen.getByRole('alert')).toHaveAccessibleName(new RegExp(text.summary(7)));
      expect(screen.getByText(text.errors.fullName)).toBeOnTheScreen();
      expect(screen.getByText(text.errors.phone)).toBeOnTheScreen();
      expect(screen.getByText(text.errors.postalCode)).toBeOnTheScreen();
      expect(screen.getByText(text.errors.exteriorNumber)).toBeOnTheScreen();
      // Observable "focus" of a screen reader: the summary is announced once, with the errors.
      expect(announce).toHaveBeenCalledTimes(1);
      expect(announce).toHaveBeenCalledWith(expect.stringContaining(text.summary(7)));
      expect(posts()).toHaveLength(0);
      expect(router.replace).not.toHaveBeenCalled();
    });

    it('VALIDATION: a bad phone alone is the only error, and fixing it lets the order go', async () => {
      mock.enqueue('POST /orders', CONFIRMED);
      await renderWithProviders(<CheckoutScreen />, { store, language });
      await fill(language, { ...VALID, phone: '55123' });

      await submit(language);

      expect(screen.getByRole('alert')).toHaveAccessibleName(new RegExp(text.summary(1)));
      expect(screen.getByText(text.errors.phone)).toBeOnTheScreen();
      expect(screen.queryByText(text.errors.fullName)).not.toBeOnTheScreen();
      expect(posts()).toHaveLength(0);

      await fill(language, { phone: '5512345678' });
      await submit(language);

      expect(posts()).toHaveLength(1);
      expect(screen.queryByText(text.errors.phone)).not.toBeOnTheScreen();
    });
  });

  it('a valid form sends ONE order with a stable key and goes to the confirmation', async () => {
    mock.enqueue('POST /orders', CONFIRMED);
    await renderWithProviders(<CheckoutScreen />, { store });
    await fill('es', VALID);

    await submit('es');

    expect(posts()).toHaveLength(1);
    expect(posts()[0]?.headers['idempotency-key']).toBe('key-0001');
    expect(router.replace).toHaveBeenCalledWith('/(tabs)/(cart)/order-confirmation');
    expect(store.getState().cart.lines).toEqual([]);
  });

  it('DOUBLE TAP on "Continuar": still ONE order is sent', async () => {
    mock.enqueue('POST /orders', CONFIRMED);
    await renderWithProviders(<CheckoutScreen />, { store });
    await fill('es', VALID);
    const button = screen.getByRole('button', { name: TEXT.es.submit });

    await fireEvent.press(button);
    await advance(100);
    await fireEvent.press(button);
    await advance(100);

    expect(posts()).toHaveLength(1);
  });

  it('the address is held by the form only: it never reaches the store', async () => {
    mock.enqueue('POST /orders', CONFIRMED);
    await renderWithProviders(<CheckoutScreen />, { store });
    await fill('es', VALID);

    await submit('es');

    const everything = JSON.stringify(store.getState());
    // (The exterior number "10" is left out: it also appears inside unrelated numbers.)
    for (const field of ['fullName', 'phone', 'postalCode', 'state', 'city', 'street'] as const) {
      expect(everything).not.toContain(VALID[field]);
    }
  });

  it('a 202 (answer not final) leaves the form for the status screen, never the confirmation', async () => {
    mock.enqueue('POST /orders', reply.success({ status: 'pending', retryAfterSeconds: 1, key: 'key-0001' }, { status: 202 }));
    await renderWithProviders(<CheckoutScreen />, { store });
    await fill('es', VALID);

    await submit('es');

    expect(router.replace).toHaveBeenCalledWith('/(tabs)/(cart)/order-status');
    expect(router.replace).not.toHaveBeenCalledWith('/(tabs)/(cart)/order-confirmation');
    expect(store.getState().cart.lines).toHaveLength(1);
  });

  it('with an empty cart the screen draws nothing and sends the user back to the cart', async () => {
    const empty = createTestStore();
    await startPersistence(empty).rehydrated;

    await renderWithProviders(<CheckoutScreen />, { store: empty });

    expect(screen.queryByRole('button', { name: TEXT.es.submit })).not.toBeOnTheScreen();
    expect(router.replace).toHaveBeenCalledWith('/(tabs)/(cart)/cart');
  });

  describe('leaving the form', () => {
    const CART = '/(tabs)/(cart)/cart';
    const CONFIRMATION = '/(tabs)/(cart)/order-confirmation';
    const STATUS = '/(tabs)/(cart)/order-status';

    it('REDIRECT: after a confirmed order the confirmation is the ONLY navigation (the emptied cart must not bounce the user to the cart)', async () => {
      mock.enqueue('POST /orders', CONFIRMED);
      await renderWithProviders(<CheckoutScreen />, { store });
      await fill('es', VALID);

      await submit('es');
      await advance(100);

      expect(store.getState().cart.lines).toEqual([]);
      expect(router.replace).toHaveBeenCalledTimes(1);
      expect(router.replace).toHaveBeenCalledWith(CONFIRMATION);
      expect(router.replace).not.toHaveBeenCalledWith(CART);
    });

    it('REDIRECT: while the order is in flight the user is not sent to the cart either', async () => {
      mock.enqueue('POST /orders', reply.success({ status: 'pending', retryAfterSeconds: 1, key: 'key-0001' }, { status: 202, delayMs: 1_000 }));
      await renderWithProviders(<CheckoutScreen />, { store });
      await fill('es', VALID);

      await fireEvent.press(screen.getByRole('button', { name: TEXT.es.submit }));
      await advance(500);

      expect(posts()).toHaveLength(1);
      expect(router.replace).not.toHaveBeenCalled();

      await advance(600);

      expect(router.replace).toHaveBeenCalledTimes(1);
      expect(router.replace).toHaveBeenCalledWith(STATUS);
    });

    it('DOUBLE TAP on "Continuar" while the first one is in flight: ONE order and ONE navigation', async () => {
      mock.enqueue('POST /orders', reply.success({ status: 'pending', retryAfterSeconds: 1, key: 'key-0001' }, { status: 202, delayMs: 1_000 }));
      await renderWithProviders(<CheckoutScreen />, { store });
      await fill('es', VALID);
      const button = screen.getByRole('button', { name: TEXT.es.submit });

      await fireEvent.press(button);
      await advance(100);
      await fireEvent.press(button);
      await advance(1_500);

      expect(posts()).toHaveLength(1);
      expect(router.replace).toHaveBeenCalledTimes(1);
      expect(router.replace).toHaveBeenCalledWith(STATUS);
    });

    it('DOUBLE TAP on a quick 200: ONE order and ONE navigation, to the confirmation', async () => {
      mock.enqueue('POST /orders', CONFIRMED);
      await renderWithProviders(<CheckoutScreen />, { store });
      await fill('es', VALID);
      const button = screen.getByRole('button', { name: TEXT.es.submit });

      await fireEvent.press(button);
      await fireEvent.press(button);
      await advance(100);

      expect(posts()).toHaveLength(1);
      expect(router.replace).toHaveBeenCalledTimes(1);
      expect(router.replace).toHaveBeenCalledWith(CONFIRMATION);
    });
  });

  describe.each<Language>(['es', 'en'])('the server rejects the data (400) in %s', (language) => {
    const text = TEXT[language];
    const VALIDATION_400 = (fields: Record<string, string>) =>
      reply.clientError(400, { error: { code: 'VALIDATION_ERROR', message: 'Order request validation failed' }, fields });

    it('points at the field the server names: announced summary, the error under the field, nothing of the body', async () => {
      const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
      announce.mockClear();
      mock.enqueue('POST /orders', VALIDATION_400({ 'shippingAddress.phone': 'INVALID_FORMAT' }));
      await renderWithProviders(<CheckoutScreen />, { store, language });
      await fill(language, VALID);

      await submit(language);
      await advance(10);

      expect(screen.getByRole('alert')).toHaveAccessibleName(new RegExp(text.summary(1)));
      expect(screen.getByText(text.serverField)).toBeOnTheScreen();
      expect(announce).toHaveBeenCalledTimes(1);
      expect(announce).toHaveBeenCalledWith(expect.stringContaining(text.summary(1)));
      const everything = JSON.stringify(screen.toJSON()) + JSON.stringify(announce.mock.calls);
      expect(everything).not.toContain('INVALID_FORMAT');
      expect(everything).not.toContain('shippingAddress');
      expect(everything).not.toContain('VALIDATION_ERROR');
      expect(router.replace).not.toHaveBeenCalled();
      expect(store.getState().checkoutAttempt).toEqual({ status: 'idle' });
      expect(store.getState().cart.lines).toHaveLength(1);
      // The form keeps what the user typed: nothing is lost because the server complained.
      expect(screen.getByLabelText(text.labels.phone)).toHaveProp('value', VALID.phone);
    });

    it('after fixing the field the same screen sends a NEW attempt and confirms', async () => {
      mock.enqueue('POST /orders', VALIDATION_400({ 'shippingAddress.phone': 'INVALID_FORMAT' }), CONFIRMED);
      await renderWithProviders(<CheckoutScreen />, { store, language });
      await fill(language, VALID);
      await submit(language);
      expect(screen.getByText(text.serverField)).toBeOnTheScreen();

      await fill(language, { phone: '5512345679' });
      await submit(language);

      expect(posts()).toHaveLength(2);
      expect(posts().map((call) => call.headers['idempotency-key'])).toEqual(['key-0001', 'key-0002']);
      expect(router.replace).toHaveBeenCalledWith('/(tabs)/(cart)/order-confirmation');
    });

    it('a complaint the form cannot place (a cart line) is ONE general alert, announced, with no field error', async () => {
      const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
      announce.mockClear();
      mock.enqueue('POST /orders', VALIDATION_400({ 'items[0].quantity': 'OUT_OF_RANGE' }));
      await renderWithProviders(<CheckoutScreen />, { store, language });
      await fill(language, VALID);

      await submit(language);
      await advance(10);

      expect(screen.getByRole('alert')).toHaveAccessibleName(text.serverGeneral);
      expect(screen.queryByText(text.serverField)).not.toBeOnTheScreen();
      expect(announce).toHaveBeenCalledTimes(1);
      expect(announce).toHaveBeenCalledWith(text.serverGeneral);
      expect(JSON.stringify(screen.toJSON())).not.toContain('OUT_OF_RANGE');
      expect(router.replace).not.toHaveBeenCalled();
    });

    it('a 400 with no readable fields is the same general alert', async () => {
      mock.enqueue('POST /orders', VALIDATION_400({}));
      await renderWithProviders(<CheckoutScreen />, { store, language });
      await fill(language, VALID);

      await submit(language);
      await advance(10);

      expect(screen.getByRole('alert')).toHaveAccessibleName(text.serverGeneral);
    });

    it('the general alert goes away when the user tries again', async () => {
      mock.enqueue('POST /orders', VALIDATION_400({ 'items[0].quantity': 'OUT_OF_RANGE' }), CONFIRMED);
      await renderWithProviders(<CheckoutScreen />, { store, language });
      await fill(language, VALID);
      await submit(language);
      expect(screen.getByRole('alert')).toBeOnTheScreen();

      await submit(language);

      expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
    });
  });

  describe.each<Language>(['es', 'en'])('out of stock (409) in %s', (language) => {
    const text = TEXT[language];
    const OUT_OF_STOCK = reply.clientError(409, { error: { code: 'OUT_OF_STOCK' } });

    beforeEach(() => {
      // The stock refresh after the 409 reads the EFFECTIVE language from the store (the persisted
      // preference, falling back to the device): this variant pins it, never the machine's own.
      store.dispatch(languageChanged(language));
    });

    it('RF-26: says so, lists what changed, announces it, keeps the form and the cart is clamped', async () => {
      const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
      announce.mockClear();
      mock.enqueue('POST /orders', OUT_OF_STOCK);
      mock.enqueue(`GET /products/${PRODUCT.productId}`, reply.localized(wireProduct(1, { stock: 1 }), language));
      await renderWithProviders(<CheckoutScreen />, { store, language });
      await fill(language, VALID);

      await submit(language);
      await advance(10);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveAccessibleName(new RegExp(text.outOfStock));
      expect(alert).toHaveAccessibleName(new RegExp(text.adjusted(PRODUCT.name, 1, 2).replace(/[()]/g, '\\$&')));
      expect(announce).toHaveBeenCalledTimes(1);
      expect(announce).toHaveBeenCalledWith(expect.stringContaining(text.outOfStock));
      expect(store.getState().cart.lines).toMatchObject([{ quantity: 1, stock: 1 }]);
      expect(store.getState().checkoutAttempt).toEqual({ status: 'idle' });
      expect(router.replace).not.toHaveBeenCalled();
      expect(screen.getByLabelText(text.labels.fullName)).toHaveProp('value', VALID.fullName);
      expect(screen.getByRole('button', { name: text.submit })).toBeOnTheScreen();
    });

    it('a product that sold out empties the cart: the notice with the removed line stays on screen instead of redirecting', async () => {
      const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
      announce.mockClear();
      mock.enqueue('POST /orders', OUT_OF_STOCK);
      mock.enqueue(`GET /products/${PRODUCT.productId}`, reply.localized(wireProduct(1, { stock: 0, inStock: false }), language));
      await renderWithProviders(<CheckoutScreen />, { store, language });
      await fill(language, VALID);

      await submit(language);
      await advance(10);

      expect(store.getState().cart.lines).toEqual([]);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAccessibleName(new RegExp(text.outOfStock));
      expect(alert).toHaveAccessibleName(new RegExp(text.removed(PRODUCT.name)));
      expect(announce).toHaveBeenCalledWith(expect.stringContaining(text.removed(PRODUCT.name)));
      expect(router.replace).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: text.submit })).toBeOnTheScreen();
    });

    it('if the catalog cannot be reached the generic notice still appears, with no lines', async () => {
      mock.enqueue('POST /orders', OUT_OF_STOCK);
      mock.always(`GET /products/${PRODUCT.productId}`, reply.networkError());
      await renderWithProviders(<CheckoutScreen />, { store, language });
      await fill(language, VALID);

      await submit(language);
      await advance(2_000);

      expect(screen.getByRole('alert')).toHaveAccessibleName(text.outOfStock);
      expect(store.getState().cart.lines).toMatchObject([{ quantity: 2 }]);
    });
  });

  describe('POST matrix at the screen (RF-17): only a valid 200 reaches the confirmation', () => {
    const STATUS = '/(tabs)/(cart)/order-status';
    const reused = reply.clientError(409, { error: { code: 'IDEMPOTENCY_KEY_REUSED' }, links: { status: '/orders/status/key-0001' } });

    it.each([
      ['202 pending', reply.success({ status: 'pending', retryAfterSeconds: 1, key: 'key-0001' }, { status: 202 })],
      ['409 key reused', reused],
      ['timeout', reply.timeout()],
      ['503', reply.serverError(503)],
      ['offline', reply.networkError()],
      ['200 with a body that breaks the contract', reply.success({ status: 'confirmed' })],
    ])('%s -> status screen, cart kept, nothing recorded, and a second tap sends no second order', async (_label, failure) => {
      mock.enqueue('POST /orders', failure);
      await renderWithProviders(<CheckoutScreen />, { store });
      await fill('es', VALID);

      await fireEvent.press(screen.getByRole('button', { name: TEXT.es.submit }));
      await advance(8_000);

      expect(router.replace).toHaveBeenCalledTimes(1);
      expect(router.replace).toHaveBeenCalledWith(STATUS);
      expect(store.getState().cart.lines).toHaveLength(1);
      expect(store.getState().orderHistory.orders).toHaveLength(0);
      expect(store.getState().checkoutAttempt).toMatchObject({ status: 'unresolved', key: 'key-0001' });

      await fireEvent.press(screen.getByRole('button', { name: TEXT.es.submit }));
      await advance(100);

      expect(posts()).toHaveLength(1);
      expect(router.replace).toHaveBeenCalledTimes(1);
    });
  });
});

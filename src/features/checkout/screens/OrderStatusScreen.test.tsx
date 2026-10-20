/// <reference types="jest" />
// RF-4 (T3a), RF-17 (T3b completes the matrix of what a consult can answer, and the restart). The "order in progress" screen, shown while an order
// has NO confirmed answer (`unresolved`). What the user sees and can do: wait, ask again, cancel the
// wait; and the invariant that nothing but a valid 200 is ever presented as a confirmed order.
//
// Compose: a `sealed interface OrderStatusUiState` with `Pending`/`Unresolved`/`Consulting`.
// SwiftUI: an enum with associated values (`.unresolved(retryAfter:)`). Both are asserted by what is
// on screen, not by the state object.
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { FOCUS_ON_MOUNT_DELAY_MS } from '@/core/accessibility/use-focus-on-mount';

import { PERSIST_KEY, PERSIST_VERSION } from '@/core/storage/persist-policy';
import { selectCanCheckout, selectIsCartLocked } from '@/features/cart/logic/cart-selectors';
import { productAdded } from '@/features/cart/store/cart-slice';
import { attemptOutcome, attemptSubmitted } from '@/features/checkout/store/checkout-attempt-slice';
import { createMemoryStorage, createTestStore, startPersistence } from '@/test/fixtures';
import { createMockFetch, reply } from '@/test/mock-fetch';
import { resetRouterMock, router } from '@/test/mock-expo-router';
import { renderWithProviders } from '@/test/render-with-providers';

import { OrderStatusScreen } from './OrderStatusScreen';

jest.mock('expo-router', () => jest.requireActual('@/test/mock-expo-router').expoRouterModule);

type Language = 'es' | 'en';

const TEXT = {
  es: {
    title: 'Pedido en proceso',
    unresolved: 'No pudimos confirmar el estado todavía.',
    pending: 'Estamos procesando tu pedido.',
    // The whole sentence, with the plural form of the language (T4b, RF-7): "1 segundo", "3 segundos".
    wait: (seconds: number) => `Puedes consultar en ${seconds} ${seconds === 1 ? 'segundo' : 'segundos'}.`,
    consult: 'Consultar estado',
    consulting: 'Consultando…',
    consultHint: 'Consulta el estado sin reenviar la dirección.',
    loading: 'Consultando el estado del pedido…',
    offline: 'Sin conexión: no hubo respuesta. Tu pedido sigue protegido.',
    error: 'El servidor no devolvió un estado válido. Tu pedido sigue protegido.',
    cancel: 'Cancelar espera',
  },
  en: {
    title: 'Order in progress',
    unresolved: 'We could not confirm its status yet.',
    pending: 'Your order is being processed.',
    wait: (seconds: number) => `You can check again in ${seconds} ${seconds === 1 ? 'second' : 'seconds'}.`,
    consult: 'Check order status',
    consulting: 'Checking…',
    consultHint: 'Checks status without resending the address.',
    loading: 'Checking the order status…',
    offline: 'No connection: there was no answer. Your order stays protected.',
    error: 'The server did not return a valid status. Your order stays protected.',
    cancel: 'Cancel waiting',
  },
} as const;

const KEY = 'key-0001';
const STATUS_ROUTE = `GET /orders/status/${KEY}`;
const CONFIRMATION = '/(tabs)/(cart)/order-confirmation';
const CHECKOUT = '/(tabs)/(cart)/checkout';

const PRODUCT = {
  productId: 'product-261009-001',
  name: 'Complete Daily Powder 001',
  unitPrice: 100,
  currency: 'MXN' as const,
  stock: 5,
};

const CONFIRMED_BODY = {
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
};
const CONFIRMED = reply.success(CONFIRMED_BODY);
const STILL_PENDING = reply.success({ status: 'pending', retryAfterSeconds: 3, key: KEY }, { status: 202 });
const NOT_CREATED = reply.clientError(404, { error: { code: 'ORDER_NOT_CREATED' }, status: 'not_created' });

const advance = (ms: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });

describe('OrderStatusScreen (order with no confirmed answer)', () => {
  let mock: ReturnType<typeof createMockFetch>;
  let store: ReturnType<typeof createTestStore>;

  beforeEach(async () => {
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

  /** The attempt a lost POST answer leaves behind (`pending`: the server did say 202). */
  const openAttempt = (kind: 'unresolved' | 'pending') => {
    store.dispatch(attemptSubmitted({ key: KEY, fingerprint: 'digest-1' }));
    store.dispatch(attemptOutcome({ source: 'post', outcome: kind === 'pending' ? 'pending' : 'uncertain' }));
  };

  const statusCalls = () => mock.calls.filter(({ method }) => method === 'GET');
  const consultButton = (language: Language) => screen.getByRole('button', { name: TEXT[language].consult });

  describe.each<Language>(['es', 'en'])('in %s', (language) => {
    const text = TEXT[language];

    it('UNRESOLVED: says it could not confirm, offers to ask again and to stop waiting', async () => {
      openAttempt('unresolved');
      await renderWithProviders(<OrderStatusScreen />, { store, language });

      expect(screen.getByRole('header', { name: text.title })).toBeOnTheScreen();
      expect(screen.getByText(text.unresolved)).toBeOnTheScreen();
      expect(consultButton(language)).toBeEnabled();
      expect(screen.getByRole('button', { name: text.cancel })).toBeEnabled();
      expect(screen.queryByText(/Order confirmed|Pedido confirmado/)).not.toBeOnTheScreen();
    });

    // RF-15 (T6b). At a large font the title, the message, the wait line and the two buttons are taller than
    // the screen (iOS AX5: about 600 pt of text beside 90 pt buttons), so they live in a scroll view.
    // Compose: `Column(Modifier.verticalScroll(...))`. SwiftUI: a `ScrollView` around the `VStack`.
    it('keeps the text and both buttons inside a ScrollView, so none is lost under a large font', async () => {
      openAttempt('unresolved');
      await renderWithProviders(<OrderStatusScreen />, { store, language });

      const scroll = screen.getByTestId('order-status-scroll');
      expect(within(scroll).getByRole('header', { name: text.title })).toBeOnTheScreen();
      expect(within(scroll).getByRole('button', { name: text.consult })).toBeOnTheScreen();
      expect(within(scroll).getByRole('button', { name: text.cancel })).toBeOnTheScreen();
    });

    // T6a. The status screen replaces the checkout, whose focused button is gone: the reader goes to
    // the title, not to the "Home" tab (what TalkBack picked on the Samsung).
    it('moves the screen-reader focus to its title once it is mounted', async () => {
      const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
      focus.mockClear();
      openAttempt('unresolved');
      await renderWithProviders(<OrderStatusScreen />, { store, language });

      await advance(FOCUS_ON_MOUNT_DELAY_MS + 10);

      expect(focus).toHaveBeenCalledTimes(1);
      const target = focus.mock.calls[0]?.[0] as { props?: { children?: unknown } };
      expect(target.props?.children).toBe(text.title);
    });

    it('PENDING: shows the wait and only lets the user ask again when it is over', async () => {
      openAttempt('pending');
      await renderWithProviders(<OrderStatusScreen />, { store, language });

      expect(screen.getByText(text.pending)).toBeOnTheScreen();
      expect(screen.getByText(text.wait(1))).toBeOnTheScreen();
      expect(consultButton(language)).toBeDisabled();

      await advance(1_000);

      expect(screen.queryByText(text.wait(1))).not.toBeOnTheScreen();
      expect(consultButton(language)).toBeEnabled();
    });
  });

  it('CONSULT -> confirmed: goes to the confirmation ONCE and clears the cart', async () => {
    openAttempt('unresolved');
    mock.enqueue(STATUS_ROUTE, CONFIRMED);
    await renderWithProviders(<OrderStatusScreen />, { store });

    await fireEvent.press(consultButton('es'));
    await advance(10);

    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith(CONFIRMATION);
    expect(store.getState().cart.lines).toEqual([]);
    expect(store.getState().orderHistory.orders.map(({ id }) => id)).toEqual(['order-0001']);
  });

  it('CONSULT: while it runs the button says so and is disabled; a double tap sends ONE request', async () => {
    openAttempt('unresolved');
    mock.enqueue(STATUS_ROUTE, reply.success(CONFIRMED_BODY, { delayMs: 1_000 }));
    await renderWithProviders(<OrderStatusScreen />, { store });

    await fireEvent.press(consultButton('es'));
    await advance(10);
    expect(screen.getByRole('button', { name: TEXT.es.consulting })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: TEXT.es.consulting }));
    await advance(10);

    expect(statusCalls()).toHaveLength(1);
    await advance(1_000);
    expect(router.replace).toHaveBeenCalledTimes(1);
  });

  it('CONSULT -> still pending: stays here, shows the new wait and never confirms', async () => {
    openAttempt('unresolved');
    mock.enqueue(STATUS_ROUTE, STILL_PENDING);
    await renderWithProviders(<OrderStatusScreen />, { store });

    await fireEvent.press(consultButton('es'));
    await advance(10);

    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByText(TEXT.es.pending)).toBeOnTheScreen();
    expect(screen.getByText(TEXT.es.wait(3))).toBeOnTheScreen();
    expect(consultButton('es')).toBeDisabled();
    expect(store.getState().cart.lines).toHaveLength(1);
    expect(store.getState().orderHistory.orders).toHaveLength(0);
  });

  it('CONSULT -> offline (no answer at all): stays unresolved, can ask again, nothing is confirmed', async () => {
    openAttempt('unresolved');
    mock.always(STATUS_ROUTE, reply.networkError());
    await renderWithProviders(<OrderStatusScreen />, { store });

    await fireEvent.press(consultButton('es'));
    await advance(1_500 + 10); // the two GET retries

    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByText(TEXT.es.unresolved)).toBeOnTheScreen();
    expect(consultButton('es')).toBeEnabled();
    expect(store.getState().checkoutAttempt).toMatchObject({ status: 'unresolved', key: KEY });
    expect(store.getState().cart.lines).toHaveLength(1);
    expect(store.getState().orderHistory.orders).toHaveLength(0);
  });

  it('CONSULT -> the server never created it: the attempt ends, the cart is kept, back to the checkout', async () => {
    openAttempt('unresolved');
    mock.enqueue(STATUS_ROUTE, NOT_CREATED);
    await renderWithProviders(<OrderStatusScreen />, { store });

    await fireEvent.press(consultButton('es'));
    await advance(10);

    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith(CHECKOUT);
    expect(store.getState().cart.lines).toHaveLength(1);
    expect(store.getState().orderHistory.orders).toHaveLength(0);
  });

  it('CANCEL WAITING: leaves the screen but the order stays protected (cart locked, same key)', async () => {
    openAttempt('unresolved');
    await renderWithProviders(<OrderStatusScreen />, { store });

    await fireEvent.press(screen.getByRole('button', { name: TEXT.es.cancel }));

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(store.getState().checkoutAttempt).toMatchObject({ status: 'unresolved', key: KEY });
    expect(statusCalls()).toHaveLength(0);
  });

  it('NO OPEN ATTEMPT: draws nothing and sends the user to the checkout, once', async () => {
    await renderWithProviders(<OrderStatusScreen />, { store });

    expect(screen.queryByRole('header')).not.toBeOnTheScreen();
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith(CHECKOUT);
  });

  // RF-17 matrix (T3b): what the SERVER can answer to "what happened to my order?". Only a valid 200
  // `confirmed` confirms; a 404/410 frees the attempt WITH the cart intact; everything else keeps the
  // order protected (unresolved, same key, cart locked) and the user can ask again.
  it('CONSULT -> 410 the key expired: the attempt ends, the cart is kept, back to the checkout', async () => {
    openAttempt('unresolved');
    mock.enqueue(STATUS_ROUTE, reply.clientError(410, { error: { code: 'IDEMPOTENCY_KEY_EXPIRED' }, status: 'expired' }));
    await renderWithProviders(<OrderStatusScreen />, { store });

    await fireEvent.press(consultButton('es'));
    await advance(10);

    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith(CHECKOUT);
    expect(store.getState().checkoutAttempt).toEqual({ status: 'idle' });
    expect(store.getState().cart.lines).toHaveLength(1);
    expect(store.getState().orderHistory.orders).toHaveLength(0);
  });

  it.each([
    { label: 'timeout', failure: reply.timeout(), wait: 8_000 + 1_500 },
    { label: '503', failure: reply.serverError(503), wait: 1_510 },
    { label: '409 key reused', failure: reply.clientError(409, { error: { code: 'IDEMPOTENCY_KEY_REUSED' }, links: { status: `/orders/status/${KEY}` } }), wait: 10 },
    { label: '200 with a body that breaks the contract', failure: reply.success({ status: 'confirmed' }), wait: 10 },
  ])('CONSULT -> $label: stays unresolved on the SAME key, never confirmed, and the user can ask again', async ({ failure, wait }) => {
    openAttempt('unresolved');
    mock.always(STATUS_ROUTE, failure);
    await renderWithProviders(<OrderStatusScreen />, { store });

    await fireEvent.press(consultButton('es'));
    await advance(wait);

    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByText(TEXT.es.unresolved)).toBeOnTheScreen();
    expect(consultButton('es')).toBeEnabled();
    expect(screen.queryByText(/Pedido confirmado/)).not.toBeOnTheScreen();
    expect(store.getState().checkoutAttempt).toMatchObject({ status: 'unresolved', key: KEY });
    expect(selectIsCartLocked(store.getState())).toBe(true);
    expect(store.getState().cart.lines).toHaveLength(1);
    expect(store.getState().orderHistory.orders).toHaveLength(0);
  });

  it('while the order is unresolved nothing re-enables checkout, and a consult that fails does not either', async () => {
    openAttempt('unresolved');
    mock.always(STATUS_ROUTE, reply.networkError());
    await renderWithProviders(<OrderStatusScreen />, { store });
    expect(selectCanCheckout(store.getState())).toBe(false);

    await fireEvent.press(consultButton('es'));
    await advance(1_510);

    expect(selectCanCheckout(store.getState())).toBe(false);
  });

  describe('RESTART: the process was killed before the answer arrived', () => {
    const LINE = { productId: PRODUCT.productId, name: PRODUCT.name, unitPrice: 100, currency: 'MXN', stock: 5, quantity: 2 };
    const persisted = () =>
      createMemoryStorage({
        initial: {
          [`persist:${PERSIST_KEY}`]: JSON.stringify({
            cart: JSON.stringify({ lines: [LINE] }),
            checkoutAttempt: JSON.stringify({ status: 'preliminary', key: 'key-restored', fingerprint: 'fp' }),
            _persist: JSON.stringify({ version: PERSIST_VERSION, rehydrated: true }),
          }),
        },
      });

    it('the attempt comes back unresolved with the cart blocked; only a valid 200 on the SAME key confirms it', async () => {
      mock.always('GET /orders/status/key-restored', reply.networkError());
      const restarted = createTestStore({ storage: persisted() });
      await startPersistence(restarted).rehydrated;
      await advance(1_510);

      expect(restarted.getState().checkoutAttempt).toMatchObject({ status: 'unresolved', key: 'key-restored' });
      expect(selectCanCheckout(restarted.getState())).toBe(false);
      expect(restarted.getState().cart.lines).toHaveLength(1);

      await renderWithProviders(<OrderStatusScreen />, { store: restarted });
      expect(screen.getByText(TEXT.es.unresolved)).toBeOnTheScreen();
      expect(router.replace).not.toHaveBeenCalled();

      mock.enqueue('GET /orders/status/key-restored', CONFIRMED);
      await fireEvent.press(consultButton('es'));
      await advance(10);

      expect(router.replace).toHaveBeenCalledTimes(1);
      expect(router.replace).toHaveBeenCalledWith(CONFIRMATION);
      expect(restarted.getState().cart.lines).toEqual([]);
      expect(restarted.getState().orderHistory.orders.map(({ id }) => id)).toEqual(['order-0001']);
      expect(restarted.getState().checkoutAttempt).toEqual({ status: 'idle' });
    });
  });

  // RF-33, RF-34 (T4): what each CONSULT leaves on screen, in both languages. The line is
  // EPHEMERAL — it lives in component state, never in the store (nothing new is persisted, and
  // nothing persisted or painted ever contains the key: RF-38). The local `unresolved` belief
  // stays underneath: a failed read changes the message, never the lock.
  //
  // Compose: `when (state) { is Loading -> ... }`. SwiftUI: one `switch` over the view state with
  // `.accessibilityAddTraits(.updatesFrequently)`/announcements per case.
  describe.each<Language>(['es', 'en'])('after a consult, in %s', (language) => {
    const text = TEXT[language];

    it('LOADING: announces the consult politely while it runs, and the line leaves with the answer', async () => {
      openAttempt('unresolved');
      mock.enqueue(STATUS_ROUTE, reply.success(CONFIRMED_BODY, { delayMs: 1_000 }));
      await renderWithProviders(<OrderStatusScreen />, { store, language });

      await fireEvent.press(consultButton(language));
      await advance(10);

      expect(screen.getByText(text.loading)).toHaveProp('accessibilityLiveRegion', 'polite');
      expect(screen.getByRole('button', { name: text.consulting })).toBeDisabled();

      await advance(1_000);

      // The message never outlives the consult that produced it (it holds no order data at all).
      expect(screen.queryByText(text.loading)).not.toBeOnTheScreen();
      expect(router.replace).toHaveBeenCalledWith(CONFIRMATION);
    });

    it('OFFLINE: transport with no answer says so assertively, keeps the lock and never prints the key', async () => {
      openAttempt('unresolved');
      mock.always(STATUS_ROUTE, reply.networkError());
      await renderWithProviders(<OrderStatusScreen />, { store, language });

      await fireEvent.press(consultButton(language));
      await advance(1_510); // the two GET retries

      expect(screen.getByText(text.offline)).toHaveProp('accessibilityLiveRegion', 'assertive');
      expect(screen.getByText(text.unresolved)).toBeOnTheScreen(); // the local belief stays
      expect(consultButton(language)).toBeEnabled(); // the accessible retry
      expect(consultButton(language)).toHaveProp('accessibilityHint', text.consultHint);
      expect(store.getState().checkoutAttempt).toMatchObject({ status: 'unresolved', key: KEY });
      const tree = JSON.stringify(screen.toJSON());
      expect(tree).not.toContain(KEY);
      expect(tree).not.toContain('fingerprint');
      expect(router.replace).not.toHaveBeenCalled();
    });

    it('ERROR (422): one request only, a safe assertive line, the unresolved lock kept, nothing echoed', async () => {
      openAttempt('unresolved');
      mock.always(STATUS_ROUTE, reply.clientError(422, { error: { code: 'UNPROCESSABLE_ENTITY' } }));
      await renderWithProviders(<OrderStatusScreen />, { store, language });

      await fireEvent.press(consultButton(language));
      await advance(10);

      expect(screen.getByText(text.error)).toHaveProp('accessibilityLiveRegion', 'assertive');
      expect(statusCalls()).toHaveLength(1); // a 4xx is never replayed blindly (RF-34)
      expect(screen.getByText(text.unresolved)).toBeOnTheScreen();
      expect(consultButton(language)).toBeEnabled();
      expect(store.getState().checkoutAttempt).toMatchObject({ status: 'unresolved', key: KEY });
      const tree = JSON.stringify(screen.toJSON());
      expect(tree).not.toContain(KEY);
      expect(tree).not.toContain('UNPROCESSABLE'); // the rejected input/code is never reflected
      expect(router.replace).not.toHaveBeenCalled();
    });

    // The rest of RF-33's matrix: the failures that DO get their own line, and the contract
    // answers that get NO extra line (they belong to RF-17–RF-19, not to copy).
    it.each([
      { label: '5xx', failure: reply.serverError(503), wait: 1_510, line: 'error' as const },
      { label: 'timeout', failure: reply.timeout(), wait: 8_000 + 1_500, line: 'error' as const },
      { label: '200 with a body that breaks the contract', failure: reply.success({ status: 'confirmed' }), wait: 10, line: 'error' as const },
      { label: '409 key reused (a contract answer)', failure: reply.clientError(409, { error: { code: 'IDEMPOTENCY_KEY_REUSED' }, links: { status: `/orders/status/${KEY}` } }), wait: 10, line: undefined },
    ])('$label -> ${line ?? "no extra line"}, base message and lock untouched', async ({ failure, wait, line }) => {
      openAttempt('unresolved');
      mock.always(STATUS_ROUTE, failure);
      await renderWithProviders(<OrderStatusScreen />, { store, language });

      await fireEvent.press(consultButton(language));
      await advance(wait);

      expect(screen.getByText(text.unresolved)).toBeOnTheScreen();
      if (line === undefined) {
        expect(screen.queryByText(text.error)).not.toBeOnTheScreen();
        expect(screen.queryByText(text.offline)).not.toBeOnTheScreen();
      } else {
        expect(screen.getByText(text[line])).toHaveProp('accessibilityLiveRegion', 'assertive');
      }
      expect(consultButton(language)).toBeEnabled();
      expect(store.getState().checkoutAttempt).toMatchObject({ status: 'unresolved', key: KEY });
      expect(JSON.stringify(screen.toJSON())).not.toContain(KEY);
      expect(router.replace).not.toHaveBeenCalled();
    });
  });
});

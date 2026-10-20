/// <reference types="jest" />
// RF-11, RF-12 (T4b). "My orders": what the user sees and hears about the orders confirmed on THIS
// installation. Read as a screen-reader user would: one element per order with a spoken summary, the
// newest first, amounts in the preferred currency, the empty state with its way back to Home, and the
// data surviving a "restart" (a new store over the same storage). Never an address, never a promise
// of sync or recovery.
//
// Compose: a Room `Flow<List<OrderEntity>>` collected by a LazyColumn whose rows use
// `Modifier.semantics(mergeDescendants = true)`. SwiftUI: a SwiftData `@Query` in a `List` whose rows
// use `.accessibilityElement(children: .combine)`.
import { act, fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { PERSIST_KEY, PERSIST_VERSION } from '@/core/storage/persist-policy';
import { currencyChanged } from '@/features/preferences/store/preferences-slice';
import { orderRecorded } from '@/features/orders/store/order-history-slice';
import { createMemoryStorage, createTestStore, startPersistence } from '@/test/fixtures';
import { TABS_STATE, resetRouterMock, router, tabsNavigation } from '@/test/mock-expo-router';
import { createMockFetch, reply } from '@/test/mock-fetch';
import { renderWithProviders } from '@/test/render-with-providers';

import { OrderHistoryScreen } from './OrderHistoryScreen';

jest.mock('expo-router', () => jest.requireActual('@/test/mock-expo-router').expoRouterModule);

type Language = 'es' | 'en';

const TEXT = {
  es: {
    intro: 'Pedidos confirmados en esta instalación de la app, del más reciente al más antiguo.',
    emptyTitle: 'Aún no tienes pedidos',
    emptyMessage: 'Los pedidos que confirmes en esta instalación aparecerán aquí.',
    goHome: 'Ir a Inicio',
    order: (id: string) => `Pedido ${id}`,
    one: '1 unidad',
    many: (n: number) => `${n} unidades`,
    total: (amount: string) => `Total: ${amount}`,
  },
  en: {
    intro: 'Orders confirmed on this installation of the app, newest first.',
    emptyTitle: "You don't have any orders yet",
    emptyMessage: 'Orders you confirm on this installation will appear here.',
    goHome: 'Go to Home',
    order: (id: string) => `Order ${id}`,
    one: '1 unit',
    many: (n: number) => `${n} units`,
    total: (amount: string) => `Total: ${amount}`,
  },
} as const;

const SECRETS = ['Ana Perez', '5512345678', 'Avenida Central', '01234'];

const summary = (id: string, createdAt: string, quantities: readonly number[], total: number, extra: Record<string, unknown> = {}) => ({
  id,
  items: quantities.map((quantity, index) => ({ productId: `product-261009-00${index + 1}`, quantity, unitPrice: 100, lineTotal: 100 * quantity })),
  currency: 'MXN' as const,
  subtotal: total - 99,
  shipping: 99,
  total,
  createdAt,
  ...extra,
});

const OLD = summary('order-0001', '2026-10-01T12:00:00.000Z', [1], 199);
const MIDDLE = summary('order-0002', '2026-10-02T12:00:00.000Z', [2, 1], 399);
const NEW = summary('order-0003', '2026-10-03T12:00:00.000Z', [1, 1], 299);

const rowLabels = () => screen.getAllByLabelText(/^(Pedido|Order) order-/).map((row) => String(row.props.accessibilityLabel));
const allText = () => JSON.stringify(screen.toJSON());

const persistors: { pause: () => void }[] = [];

beforeEach(() => {
  resetRouterMock();
});

afterEach(() => {
  for (const persistor of persistors.splice(0)) persistor.pause();
});

/** A store whose disk has answered (the screen waits for that), with `orders` recorded afterwards. */
async function readyStore(...orders: ReturnType<typeof summary>[]) {
  const store = createTestStore();
  const { persistor, rehydrated } = startPersistence(store);
  persistors.push(persistor);
  await rehydrated;
  for (const order of orders) store.dispatch(orderRecorded(order));
  return store;
}

describe.each<Language>(['es', 'en'])('OrderHistoryScreen in %s', (language) => {
  const text = TEXT[language];

  describe('with orders', () => {
    it('lists the newest order first, whatever order they were recorded in, one element per order', async () => {
      await renderWithProviders(<OrderHistoryScreen />, { store: await readyStore(MIDDLE, NEW, OLD), language });

      const labels = rowLabels();
      expect(labels).toHaveLength(3);
      expect(labels[0]).toContain('order-0003');
      expect(labels[1]).toContain('order-0002');
      expect(labels[2]).toContain('order-0001');
      for (const row of screen.getAllByLabelText(/^(Pedido|Order) order-/)) expect(row.props.accessible).toBe(true);
    });

    it('says what it shows: only what this installation confirmed, with no promise of sync or recovery', async () => {
      await renderWithProviders(<OrderHistoryScreen />, { store: await readyStore(OLD), language });

      expect(screen.getByText(text.intro)).toBeOnTheScreen();
      expect(allText()).not.toMatch(/sincroniz|synchroni|sync\b|nube|cloud|recuper|restor|respald|backup|otro dispositivo|other device/i);
    });

    it('writes each order with its id, the units in the right plural form and the total', async () => {
      await renderWithProviders(<OrderHistoryScreen />, { store: await readyStore(OLD, MIDDLE), language });

      expect(screen.getByText(text.order('order-0001'))).toBeOnTheScreen();
      expect(screen.getByText(text.one)).toBeOnTheScreen();
      expect(screen.getByText(text.many(3))).toBeOnTheScreen();
      const [newest, oldest] = rowLabels();
      expect(newest).toContain(text.order('order-0002'));
      expect(newest).toContain(text.many(3));
      expect(oldest).toContain(text.one);
      expect(oldest).toMatch(/199\.00/);
    });

    it('shows the amounts in the preferred currency, and switching it changes the view but not the stored order', async () => {
      const store = await readyStore(MIDDLE);
      await renderWithProviders(<OrderHistoryScreen />, { store, language });
      expect(rowLabels()[0]).toMatch(/399\.00/);

      await act(async () => {
        store.dispatch(currencyChanged('USD'));
      });

      // 399 MXN / 18 = 22.17 USD (rounded half up to the cent); the stored total is still 399 MXN.
      expect(rowLabels()[0]).toMatch(/22\.17/);
      expect(rowLabels()[0]).not.toMatch(/399/);
      expect(store.getState().orderHistory.orders[0]).toMatchObject({ currency: 'MXN', total: 399 });
    });

    it('speaks the date, the units and the total in one phrase, and prints the same information', async () => {
      await renderWithProviders(<OrderHistoryScreen />, { store: await readyStore(NEW), language });

      const label = rowLabels()[0] ?? '';
      expect(label).toContain(text.order('order-0003'));
      expect(label).toContain(text.many(2));
      expect(label).toMatch(/2026/);
      expect(label).toMatch(/299\.00/);
      expect(screen.getByText(text.total(label.match(/[A-Z]*\$[\d,.]+/)?.[0] ?? '?'))).toBeOnTheScreen();
    });

    it('an order whose stored date is unreadable is still listed, without a date and without "Invalid Date"', async () => {
      await renderWithProviders(<OrderHistoryScreen />, { store: await readyStore(summary('order-0009', 'not a date', [1], 199)), language });

      const label = rowLabels()[0] ?? '';
      expect(label).toContain('order-0009');
      expect(label).not.toMatch(/Invalid|undefined|NaN/);
      expect(label).toContain(text.one);
    });

    it('never shows the address, even if it slipped into the object that was recorded', async () => {
      const polluted = summary('order-0004', '2026-10-04T12:00:00.000Z', [1], 199, {
        shippingAddress: { fullName: 'Ana Perez', phone: '5512345678', street: 'Avenida Central', postalCode: '01234' },
      });
      const store = await readyStore(polluted);
      await renderWithProviders(<OrderHistoryScreen />, { store, language });

      for (const secret of SECRETS) expect(allText()).not.toContain(secret);
      expect(JSON.stringify(store.getState().orderHistory)).not.toMatch(/shippingAddress|Ana Perez|5512345678|Avenida Central/);
    });

    // RF-39 (T4): a confirmed order is a LOCAL summary (id, date, units, total) recorded at
    // confirmation time. The screen never asks the catalog, so a product that disappeared from the
    // API (detail 404) cannot hide the order, alter its amounts or empty the list.
    it('keeps the local summary of an order whose product no longer exists in the API (detail 404)', async () => {
      const mock = createMockFetch();
      mock.install();
      try {
        mock.always('GET /products/product-261009-001', reply.clientError(404, { error: { code: 'PRODUCT_NOT_FOUND' } }));
        const store = await readyStore(NEW);
        await renderWithProviders(<OrderHistoryScreen />, { store, language });

        expect(rowLabels()[0]).toContain('order-0003');
        expect(rowLabels()[0]).toMatch(/299\.00/);
        expect(mock.calls).toHaveLength(0); // the catalog is never consulted
      } finally {
        mock.uninstall();
      }
    });

    it('lets the text grow: nothing is cut to a line count or ellipsized, and nothing disables font scaling', async () => {
      await renderWithProviders(<OrderHistoryScreen />, { store: await readyStore(NEW), language });

      for (const node of [screen.getByText(text.order('order-0003')), screen.getByText(text.many(2))]) {
        expect(node.props.numberOfLines).toBeUndefined();
        expect(node.props.ellipsizeMode).toBeUndefined();
        expect(node.props.allowFontScaling).not.toBe(false);
      }
    });

    it.each(['light', 'dark'] as const)('draws the same orders in the %s theme', async (colorScheme) => {
      await renderWithProviders(<OrderHistoryScreen />, { store: await readyStore(OLD, NEW), language, colorScheme });

      expect(rowLabels()).toHaveLength(2);
      expect(screen.getByText(text.intro)).toBeOnTheScreen();
    });

    it('has nothing to press: no Home button when there are orders', async () => {
      await renderWithProviders(<OrderHistoryScreen />, { store: await readyStore(NEW), language });

      expect(screen.queryByRole('button')).not.toBeOnTheScreen();
    });
  });

  describe('without orders (RF-12)', () => {
    it('says so with a heading and a message, and offers the way to Home as a named button', async () => {
      await renderWithProviders(<OrderHistoryScreen />, { store: await readyStore(), language });

      expect(screen.getByRole('header', { name: text.emptyTitle })).toBeOnTheScreen();
      expect(screen.getByText(text.emptyMessage)).toBeOnTheScreen();
      const button = screen.getByRole('button', { name: text.goHome });
      expect(button).toBeEnabled();
      expect(button.props.accessibilityHint).toEqual(expect.any(String));
      expect(StyleSheet.flatten(button.props.style).minHeight).toBeGreaterThanOrEqual(48);
      expect(screen.queryAllByLabelText(/^(Pedido|Order) /)).toHaveLength(0);
    });

    it('"Go to Home" selects Home at its ROOT: it dispatches the Tabs plan and creates no second Home', async () => {
      await renderWithProviders(<OrderHistoryScreen />, { store: await readyStore(), language });

      await fireEvent.press(screen.getByRole('button', { name: text.goHome }));

      expect(tabsNavigation.dispatch.mock.calls.map(([action]) => action)).toEqual([
        { type: 'JUMP_TO', payload: { name: '(home)' }, target: 'tabs-key' },
      ]);
      expect(router.push).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
      expect(router.replace).not.toHaveBeenCalled();
      expect(router.dismissTo).not.toHaveBeenCalled();
    });

    it('"Go to Home" with a product stacked on Home pops that stack first, then selects the tab', async () => {
      tabsNavigation.getState.mockReturnValue({
        ...TABS_STATE,
        routes: [
          { name: '(home)', state: { key: 'home-stack-key', routes: [{ name: 'index' }, { name: 'product/[id]' }] } },
          ...TABS_STATE.routes.slice(1),
        ],
      });
      await renderWithProviders(<OrderHistoryScreen />, { store: await readyStore(), language });

      await fireEvent.press(screen.getByRole('button', { name: text.goHome }));

      expect(tabsNavigation.dispatch.mock.calls.map(([action]) => action)).toEqual([
        { type: 'POP_TO_TOP', target: 'home-stack-key' },
        { type: 'JUMP_TO', payload: { name: '(home)' }, target: 'tabs-key' },
      ]);
    });
  });
});

describe('OrderHistoryScreen and the disk (RF-11: it survives a restart)', () => {
  const STORAGE_KEY = `persist:${PERSIST_KEY}`;

  /** What a build before the preferences (v3) left on disk: orders, one of them with a smuggled address. */
  const v3Disk = () =>
    createMemoryStorage({
      initial: {
        [STORAGE_KEY]: JSON.stringify({
          orderHistory: JSON.stringify({
            orders: [OLD, { ...MIDDLE, shippingAddress: { fullName: 'Ana Perez', street: 'Avenida Central' } }],
            notifications: { records: {} },
          }),
          _persist: JSON.stringify({ version: 3, rehydrated: true }),
        }),
      },
    });

  async function launch(storage: ReturnType<typeof createMemoryStorage>) {
    const store = createTestStore({ storage });
    const { persistor, rehydrated } = startPersistence(store);
    await rehydrated;
    return { store, persistor };
  }

  it('a v3 state with orders is read by the v4 app, shown newest first, and the address is dropped on the way', async () => {
    const storage = v3Disk();
    const { store, persistor } = await launch(storage);

    await renderWithProviders(<OrderHistoryScreen />, { store, language: 'es' });

    const labels = rowLabels();
    expect(labels).toHaveLength(2);
    expect(labels[0]).toContain('order-0002');
    expect(labels[1]).toContain('order-0001');
    for (const secret of SECRETS) expect(allText()).not.toContain(secret);

    // The next write upgrades the disk to v4 without the address.
    await act(async () => {
      store.dispatch(currencyChanged('USD'));
    });
    await persistor.flush();
    const disk = JSON.parse(storage.data.get(STORAGE_KEY) ?? '{}') as Record<string, string>;
    expect(JSON.parse(disk._persist ?? '{}')).toEqual({ version: PERSIST_VERSION, rehydrated: true });
    expect(storage.data.get(STORAGE_KEY)).not.toMatch(/Ana Perez|Avenida Central|shippingAddress/);
    persistor.pause();
  });

  it('after a "restart" (a new store over the same storage) the orders recorded before are still listed', async () => {
    const storage = createMemoryStorage();
    const first = await launch(storage);
    first.store.dispatch(orderRecorded(OLD));
    first.store.dispatch(orderRecorded(NEW));
    await first.persistor.flush();
    first.persistor.pause();

    const second = await launch(storage);
    await renderWithProviders(<OrderHistoryScreen />, { store: second.store, language: 'en' });

    expect(rowLabels().map((label) => label.match(/order-\d+/)?.[0])).toEqual(['order-0003', 'order-0001']);
    expect(screen.queryByText(TEXT.en.emptyTitle)).not.toBeOnTheScreen();
    second.persistor.pause();
  });

  it('while the disk is still being read it does NOT claim there are no orders', async () => {
    const storage = createMemoryStorage({ initial: Object.fromEntries(v3Disk().data), holdReads: true });
    const store = createTestStore({ storage });
    const { persistor, rehydrated } = startPersistence(store);
    await renderWithProviders(<OrderHistoryScreen />, { store, language: 'es' });

    expect(screen.queryByText(TEXT.es.emptyTitle)).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: TEXT.es.goHome })).not.toBeOnTheScreen();

    await act(async () => {
      storage.releaseReads();
      await rehydrated;
    });

    expect(rowLabels()).toHaveLength(2);
    persistor.pause();
  });

  it('a state with no orders (or one that cannot be read) shows the empty state, not an error', async () => {
    const { store, persistor } = await launch(createMemoryStorage({ initial: { [STORAGE_KEY]: JSON.stringify({ orderHistory: '{', _persist: '{"version":4}' }) } }));

    await renderWithProviders(<OrderHistoryScreen />, { store, language: 'es' });

    expect(screen.getByRole('header', { name: TEXT.es.emptyTitle })).toBeOnTheScreen();
    persistor.pause();
  });
});

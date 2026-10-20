/// <reference types="jest" />
// RF-17, RF-4 (T3b). A category when the server cannot be reached, in the three situations the user
// meets: never loaded (offline screen with a retry), loaded before (the products stay, with a notice),
// and a link that is not a category (never asks the server). The grid/list internals are in
// `ProductListView.test.tsx`; this file checks what THIS screen adds: the category title stays on
// screen in every state, and the retry belongs to the category.
//
// Compose: a `NavHost` destination test with a fake repository that throws `IOException`.
// SwiftUI: a view model with a stubbed `URLSession` that fails with `URLError.notConnectedToInternet`.
import { act, fireEvent, screen } from '@testing-library/react-native';

import { setAppForeground } from '@/test/app-state';
import { wireBrands, wireCategories, wireProductPage } from '@/test/fixtures';
import { createMockFetch, reply } from '@/test/mock-fetch';
import { resetRouterMock } from '@/test/mock-expo-router';
import { emitReconnect, resetReconnectionMock } from '@/test/mock-reconnection';
import { renderWithProviders } from '@/test/render-with-providers';

import { CategoryProductsScreen } from './CategoryProductsScreen';

jest.mock('expo-router', () => jest.requireActual('@/test/mock-expo-router').expoRouterModule);
jest.mock('@/core/network/reconnection', () => jest.requireActual('@/test/mock-reconnection').reconnectionModule);

type Language = 'es' | 'en';

const TEXT = {
  es: {
    title: 'Vitaminas',
    genericTitle: 'Categoría',
    remoteTitle: 'Vitaminas del sol',
    offlineTitle: 'Sin conexión con el servidor',
    errorTitle: 'No se pudieron cargar los productos',
    retry: 'Reintentar',
    count: (n: number) => `${n} productos`,
    offlineNotice: 'Sin conexión. Se muestran los últimos productos recibidos.',
    invalidTitle: 'Categoría no encontrada',
  },
  en: {
    title: 'Vitamins',
    genericTitle: 'Category',
    remoteTitle: 'Sunshine vitamins',
    offlineTitle: 'No connection to the server',
    errorTitle: "Products couldn't be loaded",
    retry: 'Try again',
    count: (n: number) => `${n} products`,
    offlineNotice: 'You are offline. Showing the last products received.',
    invalidTitle: 'Category not found',
  },
} as const;

const advance = (ms: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });

describe('CategoryProductsScreen offline', () => {
  let mock: ReturnType<typeof createMockFetch>;

  beforeEach(() => {
    jest.useFakeTimers();
    resetRouterMock();
    resetReconnectionMock();
    setAppForeground();
    mock = createMockFetch();
    mock.install();
  });

  afterEach(() => {
    expect(mock.unmatched).toEqual([]);
    mock.uninstall();
  });

  const productRequests = () => mock.calls.filter(({ path }) => path === '/products');

  /**
   * `renderWithProviders` plus the answers the advanced-filters sheet needs: the sheet is mounted
   * (closed) with the screen and reads its options in the language of THAT render, which only the
   * render arguments know, so the permanent replies are set here and not in `beforeEach`.
   */
  type RenderArgs = Parameters<typeof renderWithProviders>;
  const render = (ui: RenderArgs[0], options: NonNullable<RenderArgs[1]> = {}) => {
    const language = options.language ?? 'es';
    mock.always('GET /brands', reply.localized(wireBrands(), language));
    mock.always('GET /categories', reply.localized(wireCategories(language), language));
    return renderWithProviders(ui, options);
  };

  describe.each<Language>(['es', 'en'])('in %s', (language) => {
    const text = TEXT[language];

    it('NO DATA: the category title stays, the screen says "no connection" and "retry" recovers', async () => {
      mock.enqueue('GET /products', reply.networkError(), reply.networkError(), reply.networkError());
      await render(<CategoryProductsScreen rawId="vitamins" />, { language });
      await advance(1_510);

      expect(screen.getByRole('header', { name: text.title })).toBeOnTheScreen();
      expect(screen.getByRole('header', { name: text.offlineTitle })).toBeOnTheScreen();
      expect(screen.queryByText(text.errorTitle)).not.toBeOnTheScreen();
      expect(productRequests()).toHaveLength(3);

      mock.enqueue('GET /products', reply.localized(wireProductPage(2), language));
      await fireEvent.press(screen.getByRole('button', { name: text.retry }));
      await advance(10);

      expect(screen.getByText(text.count(2))).toBeOnTheScreen();
      expect(screen.queryByRole('header', { name: text.offlineTitle })).not.toBeOnTheScreen();
      expect(screen.getByRole('header', { name: text.title })).toBeOnTheScreen();
    });

    it('SERVER ERROR is a different message from "no connection", with the same retry', async () => {
      mock.enqueue('GET /products', reply.serverError(), reply.serverError(), reply.serverError());
      await render(<CategoryProductsScreen rawId="vitamins" />, { language });
      await advance(1_510);

      expect(screen.getByRole('header', { name: text.errorTitle })).toBeOnTheScreen();
      expect(screen.queryByRole('header', { name: text.offlineTitle })).not.toBeOnTheScreen();
      expect(screen.getByRole('button', { name: text.retry })).toBeOnTheScreen();
    });

    it('PREVIOUS PRODUCTS: a failed revalidation keeps them, the title and a notice', async () => {
      mock.enqueue('GET /products', reply.localized(wireProductPage(2), language));
      await render(<CategoryProductsScreen rawId="vitamins" />, { language });
      await advance(10);
      await advance(61_000);
      mock.enqueue('GET /products', reply.networkError(), reply.networkError(), reply.networkError());

      await act(async () => {
        emitReconnect();
      });
      await advance(1_510);

      expect(screen.getByText(text.offlineNotice)).toBeOnTheScreen();
      expect(screen.getByText(text.count(2))).toBeOnTheScreen();
      expect(screen.getByRole('header', { name: text.title })).toBeOnTheScreen();
      expect(screen.queryByRole('header', { name: text.offlineTitle })).not.toBeOnTheScreen();
    });
  });

  // RF-9, RF-22, RF-35 (spec 007, T3). The header is copy OF THE CATALOG: the name that comes in
  // the localized category tree. The app used to translate five known ids itself, so the header
  // could disagree with the API; a name it does not know must appear exactly as sent, and while
  // the tree is still in flight the header is the generic chrome (i18n owns only that fallback).
  //
  // Android: `string.xml` per category id drifts from the backend; SwiftUI: a `Localizable` entry
  // per server id has the same problem. The response owns the name.
  describe.each<Language>(['es', 'en'])('TITLE from the API, in %s', (language) => {
    const text = TEXT[language];

    it('RF-9: shows the name of the localized tree, and the generic chrome until it arrives', async () => {
      mock.always('GET /products', reply.localized(wireProductPage(1), language));
      mock.enqueue(
        'GET /categories',
        reply.localized(
          [{ id: 'vitamins', name: text.remoteTitle, productCount: 12, subcategories: [] }],
          language,
          { delayMs: 1_000 },
        ),
      );

      await render(<CategoryProductsScreen rawId="vitamins" />, { language });

      // The tree is still in flight: the header is the generic chrome, not a local translation.
      expect(screen.getByRole('header', { name: text.genericTitle })).toBeOnTheScreen();
      expect(screen.queryByRole('header', { name: text.title })).not.toBeOnTheScreen();

      await advance(1_010);

      expect(screen.getByRole('header', { name: text.remoteTitle })).toBeOnTheScreen();
      expect(screen.queryByRole('header', { name: text.genericTitle })).not.toBeOnTheScreen();
    });
  });

  it('a link that is not a category never asks the server', async () => {
    await render(<CategoryProductsScreen rawId="../etc" />);
    await advance(2_000);

    expect(screen.getByText(TEXT.es.invalidTitle)).toBeOnTheScreen();
    expect(mock.calls).toHaveLength(0);
  });
});

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
    offlineTitle: 'Sin conexión con el servidor',
    errorTitle: 'No se pudieron cargar los productos',
    retry: 'Reintentar',
    count: (n: number) => `${n} productos`,
    offlineNotice: 'Sin conexión. Se muestran los últimos productos recibidos.',
    invalidTitle: 'Categoría no encontrada',
  },
  en: {
    title: 'Vitamins',
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
    mock.always('GET /brands', reply.success(wireBrands()));
    mock.always('GET /categories', reply.success(wireCategories()));
  });

  afterEach(() => {
    expect(mock.unmatched).toEqual([]);
    mock.uninstall();
  });

  const productRequests = () => mock.calls.filter(({ path }) => path === '/products');

  describe.each<Language>(['es', 'en'])('in %s', (language) => {
    const text = TEXT[language];

    it('NO DATA: the category title stays, the screen says "no connection" and "retry" recovers', async () => {
      mock.enqueue('GET /products', reply.networkError(), reply.networkError(), reply.networkError());
      await renderWithProviders(<CategoryProductsScreen rawId="vitamins" />, { language });
      await advance(1_510);

      expect(screen.getByRole('header', { name: text.title })).toBeOnTheScreen();
      expect(screen.getByRole('header', { name: text.offlineTitle })).toBeOnTheScreen();
      expect(screen.queryByText(text.errorTitle)).not.toBeOnTheScreen();
      expect(productRequests()).toHaveLength(3);

      mock.enqueue('GET /products', reply.success(wireProductPage(2)));
      await fireEvent.press(screen.getByRole('button', { name: text.retry }));
      await advance(10);

      expect(screen.getByText(text.count(2))).toBeOnTheScreen();
      expect(screen.queryByRole('header', { name: text.offlineTitle })).not.toBeOnTheScreen();
      expect(screen.getByRole('header', { name: text.title })).toBeOnTheScreen();
    });

    it('SERVER ERROR is a different message from "no connection", with the same retry', async () => {
      mock.enqueue('GET /products', reply.serverError(), reply.serverError(), reply.serverError());
      await renderWithProviders(<CategoryProductsScreen rawId="vitamins" />, { language });
      await advance(1_510);

      expect(screen.getByRole('header', { name: text.errorTitle })).toBeOnTheScreen();
      expect(screen.queryByRole('header', { name: text.offlineTitle })).not.toBeOnTheScreen();
      expect(screen.getByRole('button', { name: text.retry })).toBeOnTheScreen();
    });

    it('PREVIOUS PRODUCTS: a failed revalidation keeps them, the title and a notice', async () => {
      mock.enqueue('GET /products', reply.success(wireProductPage(2)));
      await renderWithProviders(<CategoryProductsScreen rawId="vitamins" />, { language });
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

  it('a link that is not a category never asks the server', async () => {
    await renderWithProviders(<CategoryProductsScreen rawId="../etc" />);
    await advance(2_000);

    expect(screen.getByText(TEXT.es.invalidTitle)).toBeOnTheScreen();
    expect(mock.calls).toHaveLength(0);
  });
});

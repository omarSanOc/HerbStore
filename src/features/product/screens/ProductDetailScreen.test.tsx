/// <reference types="jest" />
// RF-17, RF-4 (T3b). The product detail when the server cannot be reached:
//   - never loaded: "no connection" (a connection problem) is a different screen from "the server
//     failed", both with a retry that asks again and recovers;
//   - loaded before: the product (and its stock) stay on screen when a revalidation fails, now WITH a
//     notice (user decision after T3b; Day 4 had none): a polite `alert` that says the price and
//     the availability may be out of date, with a retry that recovers and makes it disappear;
//   - a 404 is final: "not found" wins over what was cached, and no notice is shown.
//
// Compose: a `ProductDetailRoute` test with a repository that fails once. SwiftUI: a view model with a
// stubbed `URLSession`.
import { act, fireEvent, screen } from '@testing-library/react-native';

import { setAppForeground } from '@/test/app-state';
import { createTestStore, startPersistence, wireProduct } from '@/test/fixtures';
import { createMockFetch, reply } from '@/test/mock-fetch';
import { resetRouterMock } from '@/test/mock-expo-router';
import { emitReconnect, resetReconnectionMock } from '@/test/mock-reconnection';
import { renderWithProviders } from '@/test/render-with-providers';

import { ProductDetailScreen } from './ProductDetailScreen';

jest.mock('expo-router', () => jest.requireActual('@/test/mock-expo-router').expoRouterModule);
jest.mock('@/core/network/reconnection', () => jest.requireActual('@/test/mock-reconnection').reconnectionModule);

type Language = 'es' | 'en';

const ID = 'product-261009-001';
const ROUTE = `GET /products/${ID}`;
const NAME = 'Complete Daily Powder 001';

const TEXT = {
  es: {
    loading: 'Cargando producto…',
    offlineTitle: 'Sin conexión con el servidor',
    errorTitle: 'No se pudo cargar el producto',
    notFoundTitle: 'Producto no encontrado',
    retry: 'Reintentar',
    add: 'Agregar al carrito',
    stock: 'Disponible: 5 unidades',
    offlineNotice:
      'Sin conexión. Se muestran los últimos datos recibidos; el precio y la disponibilidad pueden haber cambiado.',
    failedNotice:
      'No se pudo actualizar el producto. Se muestran los últimos datos recibidos; el precio y la disponibilidad pueden haber cambiado.',
  },
  en: {
    loading: 'Loading product…',
    offlineTitle: 'No connection to the server',
    errorTitle: "The product couldn't be loaded",
    notFoundTitle: 'Product not found',
    retry: 'Try again',
    add: 'Add to cart',
    stock: 'In stock: 5 units',
    offlineNotice:
      'You are offline. Showing the last data received; the price and availability may have changed.',
    failedNotice:
      'The product could not be updated. Showing the last data received; the price and availability may have changed.',
  },
} as const;

const detail = (stock = 5) => reply.success(wireProduct(1, { stock, inStock: stock > 0 }));

const advance = (ms: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });

describe('ProductDetailScreen offline', () => {
  let mock: ReturnType<typeof createMockFetch>;
  let store: ReturnType<typeof createTestStore>;

  beforeEach(async () => {
    jest.useFakeTimers();
    resetRouterMock();
    resetReconnectionMock();
    setAppForeground();
    mock = createMockFetch();
    mock.install();
    // The content reads the cart lock, which needs the persisted state to have been restored.
    store = createTestStore();
    await startPersistence(store).rehydrated;
  });

  afterEach(() => {
    expect(mock.unmatched).toEqual([]);
    mock.uninstall();
  });

  const requests = () => mock.calls.filter(({ path }) => path === `/products/${ID}`);
  const productName = () => screen.getByRole('header', { name: NAME });

  describe.each<Language>(['es', 'en'])('in %s', (language) => {
    const text = TEXT[language];

    it('NO DATA, no connection: says so (not "server error") and "retry" asks again and recovers', async () => {
      mock.enqueue(ROUTE, reply.networkError(), reply.networkError(), reply.networkError());
      await renderWithProviders(<ProductDetailScreen rawId={ID} />, { language, store });
      expect(screen.getByLabelText(text.loading)).toBeOnTheScreen();

      await advance(1_510);

      expect(requests()).toHaveLength(3);
      expect(screen.getByRole('header', { name: text.offlineTitle })).toBeOnTheScreen();
      expect(screen.queryByText(text.errorTitle)).not.toBeOnTheScreen();

      mock.enqueue(ROUTE, detail());
      await fireEvent.press(screen.getByRole('button', { name: text.retry }));
      await advance(10);

      expect(requests()).toHaveLength(4);
      expect(productName()).toBeOnTheScreen();
      expect(screen.queryByText(text.offlineTitle)).not.toBeOnTheScreen();
    });

    it('NO DATA, server error: a different title with the same retry', async () => {
      mock.enqueue(ROUTE, reply.serverError(), reply.serverError(), reply.serverError());
      await renderWithProviders(<ProductDetailScreen rawId={ID} />, { language, store });
      await advance(1_510);

      expect(screen.getByRole('header', { name: text.errorTitle })).toBeOnTheScreen();
      expect(screen.queryByText(text.offlineTitle)).not.toBeOnTheScreen();
      expect(screen.getByRole('button', { name: text.retry })).toBeOnTheScreen();
    });

    async function loadThenGoStale() {
      mock.enqueue(ROUTE, detail(5));
      await renderWithProviders(<ProductDetailScreen rawId={ID} />, { language, store });
      await advance(10);
      expect(productName()).toBeOnTheScreen();
      expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
      await advance(61_000);
    }

    it('PREVIOUS DATA, offline: keeps the product, the stock and "Add to cart" and warns that price and stock may be old', async () => {
      await loadThenGoStale();
      mock.enqueue(ROUTE, reply.networkError(), reply.networkError(), reply.networkError());

      await act(async () => {
        emitReconnect();
      });
      await advance(1_510);

      expect(requests()).toHaveLength(4);
      expect(productName()).toBeOnTheScreen();
      expect(screen.getByText(text.stock)).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: text.add })).toBeOnTheScreen();
      // An accessible live region (announced when it appears), not a full error screen.
      const notice = screen.getByRole('alert', { name: text.offlineNotice });
      expect(notice).toBeOnTheScreen();
      expect(notice).toHaveProp('accessibilityLiveRegion', 'polite');
      // Android does not scale an explicit `lineHeight` with the system font scale. At 2.0 the
      // larger glyphs were therefore painted inside the old 24/20 dp boxes and clipped. These two
      // texts deliberately use their natural line boxes so the card and button grow with them.
      expect(notice).toHaveStyle({ lineHeight: undefined });
      const retry = screen.getByRole('button', { name: text.retry });
      expect(retry).toBeOnTheScreen();
      expect(screen.getByText(text.retry)).toHaveStyle({ lineHeight: undefined });
      expect(screen.queryByText(text.failedNotice)).not.toBeOnTheScreen();
      expect(screen.queryByText(text.offlineTitle)).not.toBeOnTheScreen();
      expect(screen.queryByText(text.errorTitle)).not.toBeOnTheScreen();
    });

    it('PREVIOUS DATA, server error: same product, a different notice ("could not be updated", not "offline")', async () => {
      await loadThenGoStale();
      mock.enqueue(ROUTE, reply.serverError(), reply.serverError(), reply.serverError());

      await act(async () => {
        emitReconnect();
      });
      await advance(1_510);

      expect(screen.getByRole('alert', { name: text.failedNotice })).toBeOnTheScreen();
      expect(screen.queryByText(text.offlineNotice)).not.toBeOnTheScreen();
      expect(productName()).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: text.add })).toBeOnTheScreen();
    });

    it('PREVIOUS DATA: "retry" in the notice asks again, shows the NEW stock and the notice goes away', async () => {
      await loadThenGoStale();
      mock.enqueue(ROUTE, reply.networkError(), reply.networkError(), reply.networkError());
      await act(async () => {
        emitReconnect();
      });
      await advance(1_510);
      expect(screen.getByRole('alert')).toBeOnTheScreen();

      mock.enqueue(ROUTE, detail(3));
      await fireEvent.press(screen.getByRole('button', { name: text.retry }));
      await advance(10);

      expect(requests()).toHaveLength(5);
      expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: text.retry })).not.toBeOnTheScreen();
      expect(productName()).toBeOnTheScreen();
      expect(screen.queryByText(text.stock)).not.toBeOnTheScreen();
    });

    it('PREVIOUS DATA: when the connection comes back on its own, the next revalidation clears the notice', async () => {
      await loadThenGoStale();
      mock.enqueue(ROUTE, reply.networkError(), reply.networkError(), reply.networkError());
      await act(async () => {
        emitReconnect();
      });
      await advance(1_510);
      expect(screen.getByRole('alert', { name: text.offlineNotice })).toBeOnTheScreen();

      // The failed answer is stale as well (it is a "fetch" that settled now), so coming back to the
      // foreground / reconnecting asks again.
      await advance(61_000);
      mock.enqueue(ROUTE, detail(5));
      await act(async () => {
        emitReconnect();
      });
      await advance(10);

      expect(requests()).toHaveLength(5);
      expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
    });

    it('FRESH data (< 60 s) is not requested again on reconnection: nothing can fail, nothing is warned', async () => {
      mock.enqueue(ROUTE, detail(5));
      await renderWithProviders(<ProductDetailScreen rawId={ID} />, { language, store });
      await advance(10);

      await act(async () => {
        emitReconnect();
      });
      await advance(2_000);

      expect(requests()).toHaveLength(1);
      expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
    });

    it('PREVIOUS DATA: a revalidation that answers 404 is final, the product is gone', async () => {
      mock.enqueue(ROUTE, detail(5));
      await renderWithProviders(<ProductDetailScreen rawId={ID} />, { language, store });
      await advance(10);
      await advance(61_000);
      mock.enqueue(ROUTE, reply.clientError(404, { error: { code: 'NOT_FOUND' } }));

      await act(async () => {
        emitReconnect();
      });
      await advance(10);

      expect(screen.getByText(text.notFoundTitle)).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: text.add })).not.toBeOnTheScreen();
      expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
    });
  });

  it('a link that is not a product never asks the server', async () => {
    await renderWithProviders(<ProductDetailScreen rawId="../etc" />, { store });
    await advance(2_000);

    expect(mock.calls).toHaveLength(0);
  });
});

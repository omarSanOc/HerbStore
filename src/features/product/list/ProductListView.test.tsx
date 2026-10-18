/// <reference types="jest" />
// RF-4, RF-5 (T3a). What the user SEES and CAN DO in every state of a product list: loading,
// products, empty, empty because of filters, server error, offline, and the footer of "load more".
// Everything is found by role, accessible name or visible text; no `testID`, no internals.
//
// The data comes from the controlled `fetch` (`mock-fetch.ts`), so the same RTK Query stack the app
// runs decides each state. Time is a test input (fake timers).
//
// Compose: `composeTestRule.onNodeWithText("Retry").assertExists().performClick()` over a
// `sealed interface UiState`. XCUITest: `app.buttons["Try again"].exists` for each enum case.
import { act, fireEvent, screen } from '@testing-library/react-native';

import { useReducedMotionPreference } from '@/core/accessibility/use-reduced-motion';
import { wireBrands, wireCategories, wireProductPage } from '@/test/fixtures';
import { createMockFetch, reply } from '@/test/mock-fetch';
import { setAppForeground } from '@/test/app-state';
import { resetRouterMock } from '@/test/mock-expo-router';
import { emitReconnect, resetReconnectionMock } from '@/test/mock-reconnection';
import { renderWithProviders } from '@/test/render-with-providers';

import { ProductListFooterRow } from './ProductListStatus';
import { ProductListView } from './ProductListView';

jest.mock('expo-router', () => jest.requireActual('@/test/mock-expo-router').expoRouterModule);
jest.mock('@/core/network/reconnection', () => jest.requireActual('@/test/mock-reconnection').reconnectionModule);
jest.mock('@/core/accessibility/use-reduced-motion', () => ({ useReducedMotionPreference: jest.fn(() => false) }));

type Language = 'es' | 'en';

/** The words each language must show for each state. A missing key would show the key itself. */
const TEXT = {
  es: {
    loading: 'Cargando productos',
    count: (n: number) => `${n} ${n === 1 ? 'producto' : 'productos'}`,
    emptyTitle: 'No hay productos',
    filteredTitle: 'Ningún producto coincide',
    clearFilters: 'Limpiar filtros',
    errorTitle: 'No se pudieron cargar los productos',
    offlineTitle: 'Sin conexión con el servidor',
    retry: 'Reintentar',
    inStock: 'Disponible',
    loadingMore: 'Cargando más productos…',
    loadMoreFailed: 'No se pudieron cargar más productos.',
    offlineNotice: 'Sin conexión. Se muestran los últimos productos recibidos.',
    failedNotice: 'No se pudo actualizar la lista. Se muestran los últimos productos recibidos.',
  },
  en: {
    loading: 'Loading products',
    count: (n: number) => `${n} ${n === 1 ? 'product' : 'products'}`,
    emptyTitle: 'No products',
    filteredTitle: 'No products match',
    clearFilters: 'Clear filters',
    errorTitle: "Products couldn't be loaded",
    offlineTitle: 'No connection to the server',
    retry: 'Try again',
    inStock: 'Available',
    loadingMore: 'Loading more products…',
    loadMoreFailed: 'More products could not be loaded.',
    offlineNotice: 'You are offline. Showing the last products received.',
    failedNotice: 'The list could not be updated. Showing the last products received.',
  },
} as const;

/**
 * The only place that asks by type: a spinner has no role, name or text of its own (the text beside
 * it is what a screen reader reads), so the rendered tree is the only way to tell it is drawn.
 */
const isSpinnerDrawn = () => JSON.stringify(screen.toJSON()).includes('"type":"ActivityIndicator"');

const advance = (ms: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });

describe('ProductListView states', () => {
  let mock: ReturnType<typeof createMockFetch>;

  beforeEach(() => {
    jest.useFakeTimers();
    resetRouterMock();
    resetReconnectionMock();
    setAppForeground();
    jest.mocked(useReducedMotionPreference).mockReturnValue(false);
    mock = createMockFetch();
    mock.install();
    // The advanced-filters sheet is mounted (closed) and reads its options; they are not under test.
    mock.always('GET /brands', reply.success(wireBrands()));
    mock.always('GET /categories', reply.success(wireCategories()));
  });

  afterEach(() => {
    // A state that was not asserted is a request nobody expected.
    expect(mock.unmatched).toEqual([]);
    mock.uninstall();
  });

  const productRequests = () => mock.calls.filter(({ path }) => path === '/products');

  async function mount(language: Language = 'es', onOpenProduct = jest.fn()) {
    const view = await renderWithProviders(
      <ProductListView header={null} onOpenProduct={onOpenProduct} scope={{ category: 'vitamins' }} />,
      { language },
    );
    return { ...view, onOpenProduct };
  }

  describe.each<Language>(['es', 'en'])('in %s', (language) => {
    const text = TEXT[language];

    it('LOADING: shows one busy, named placeholder and offers no retry', async () => {
      mock.enqueue('GET /products', reply.success(wireProductPage(2), { delayMs: 1_000 }));
      await mount(language);

      expect(screen.getByLabelText(text.loading)).toBeOnTheScreen();
      expect(screen.getByLabelText(text.loading)).toBeBusy();
      expect(screen.queryByRole('button', { name: text.retry })).not.toBeOnTheScreen();
      expect(screen.queryByText(text.errorTitle)).not.toBeOnTheScreen();

      await advance(1_000);
      await advance(10);
      expect(screen.queryByLabelText(text.loading)).not.toBeOnTheScreen();
    });

    it('READY: shows the counter and each product as a button; tapping one opens it', async () => {
      mock.enqueue('GET /products', reply.success(wireProductPage(3)));
      const { onOpenProduct } = await mount(language);
      await advance(10);

      expect(screen.getByText(text.count(3))).toBeOnTheScreen();
      const cards = screen.getAllByRole('button', { name: /Complete Daily Powder 00[123]/ });
      expect(cards).toHaveLength(3);

      await fireEvent.press(cards[1]);
      expect(onOpenProduct).toHaveBeenCalledWith('product-261009-002');
    });

    it('EMPTY: says there is nothing (not an error) and has no retry', async () => {
      mock.enqueue('GET /products', reply.empty());
      await mount(language);
      await advance(10);

      expect(screen.getByRole('header', { name: text.emptyTitle })).toBeOnTheScreen();
      expect(screen.queryByText(text.errorTitle)).not.toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: text.retry })).not.toBeOnTheScreen();
    });

    it('EMPTY because of filters: offers "clear filters" and pressing it asks for the full list again', async () => {
      mock.enqueue('GET /products', reply.success(wireProductPage(2)), reply.empty());
      await mount(language);
      await advance(10);

      await fireEvent.press(screen.getByRole('button', { name: text.inStock }));
      await advance(10);

      expect(screen.getByRole('header', { name: text.filteredTitle })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: text.inStock })).toBeSelected();
      expect(productRequests()[1].url).toContain('inStock=true');

      // The same query as the first one is still cached, so clearing does not need the network.
      await fireEvent.press(screen.getByRole('button', { name: text.clearFilters }));
      await advance(10);
      expect(screen.getByText(text.count(2))).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: text.inStock })).not.toBeSelected();
    });

    it('SERVER ERROR: after the GET retries it says so and "retry" asks again and recovers', async () => {
      mock.enqueue('GET /products', reply.serverError(), reply.serverError(), reply.serverError());
      await mount(language);
      await advance(1_500 + 10); // 500 ms + 1 000 ms of backoff

      expect(productRequests()).toHaveLength(3);
      expect(screen.getByRole('header', { name: text.errorTitle })).toBeOnTheScreen();
      expect(screen.queryByText(text.offlineTitle)).not.toBeOnTheScreen();

      mock.enqueue('GET /products', reply.success(wireProductPage(2)));
      await fireEvent.press(screen.getByRole('button', { name: text.retry }));
      await advance(10);

      expect(productRequests()).toHaveLength(4);
      expect(screen.getByText(text.count(2))).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: text.retry })).not.toBeOnTheScreen();
    });

    it('OFFLINE: says there is no connection (not "error") and "retry" asks again', async () => {
      mock.enqueue('GET /products', reply.networkError(), reply.networkError(), reply.networkError());
      await mount(language);
      await advance(1_500 + 10);

      expect(screen.getByRole('header', { name: text.offlineTitle })).toBeOnTheScreen();
      expect(screen.queryByText(text.errorTitle)).not.toBeOnTheScreen();

      mock.enqueue('GET /products', reply.success(wireProductPage(1)));
      await fireEvent.press(screen.getByRole('button', { name: text.retry }));
      await advance(10);

      expect(productRequests()).toHaveLength(4);
      expect(screen.getByText(text.count(1))).toBeOnTheScreen();
    });
  });

  it('a 4xx is an error with a retry, and it is NOT retried by itself', async () => {
    mock.enqueue('GET /products', reply.clientError(400));
    await mount('es');
    await advance(2_000);

    expect(productRequests()).toHaveLength(1);
    expect(screen.getByRole('header', { name: TEXT.es.errorTitle })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: TEXT.es.retry })).toBeOnTheScreen();
  });

  it('a timeout is an error with a retry', async () => {
    mock.enqueue('GET /products', reply.timeout());
    await mount('es');
    await advance(8_000 + 10); // the 8 s request limit of `fetchJson`

    expect(screen.getByRole('header', { name: TEXT.es.errorTitle })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: TEXT.es.retry })).toBeOnTheScreen();
  });

  it('keeps the filter bar on screen in every state, so a failure never traps the user', async () => {
    mock.enqueue('GET /products', reply.serverError(), reply.serverError(), reply.serverError());
    await mount('es');
    await advance(1_510);

    expect(screen.getByRole('header', { name: TEXT.es.errorTitle })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /^Ordenar: / })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: TEXT.es.inStock })).toBeOnTheScreen();
  });

  // RF-17 (T3b). Products were loaded, they went stale (>= 60 s) and the device reconnects: the
  // background revalidation fails. The list keeps the products, warns, and offers a retry. This view
  // is the one Category and Search use, so the three screens share this behaviour.
  describe.each<Language>(['es', 'en'])('PREVIOUS PRODUCTS after a failed revalidation, in %s', (language) => {
    const text = TEXT[language];

    async function loadThenGoStale() {
      mock.enqueue('GET /products', reply.success(wireProductPage(2)));
      await mount(language);
      await advance(10);
      expect(screen.getByText(text.count(2))).toBeOnTheScreen();
      await advance(61_000);
    }

    it('OFFLINE: keeps the products, warns "offline" (not the offline screen) and "retry" recovers', async () => {
      await loadThenGoStale();
      mock.enqueue('GET /products', reply.networkError(), reply.networkError(), reply.networkError());

      await act(async () => {
        emitReconnect();
      });
      await advance(1_510);

      expect(productRequests()).toHaveLength(4);
      expect(screen.getByText(text.offlineNotice)).toBeOnTheScreen();
      expect(screen.getByText(text.count(2))).toBeOnTheScreen();
      expect(screen.queryByRole('header', { name: text.offlineTitle })).not.toBeOnTheScreen();

      mock.enqueue('GET /products', reply.success(wireProductPage(3)));
      await fireEvent.press(screen.getByRole('button', { name: text.retry }));
      await advance(10);

      expect(screen.queryByText(text.offlineNotice)).not.toBeOnTheScreen();
      expect(screen.getByText(text.count(3))).toBeOnTheScreen();
    });

    it('SERVER ERROR: keeps the products and says the update failed (not "offline")', async () => {
      await loadThenGoStale();
      mock.enqueue('GET /products', reply.serverError(), reply.serverError(), reply.serverError());

      await act(async () => {
        emitReconnect();
      });
      await advance(1_510);

      expect(screen.getByText(text.failedNotice)).toBeOnTheScreen();
      expect(screen.queryByText(text.offlineNotice)).not.toBeOnTheScreen();
      expect(screen.getByText(text.count(2))).toBeOnTheScreen();
    });
  });

  describe('footer of "load more"', () => {
    it('LOADING MORE: shows text and a spinner', async () => {
      await renderWithProviders(<ProductListFooterRow footer="loading-more" />);

      expect(screen.getByText(TEXT.es.loadingMore)).toBeOnTheScreen();
      expect(isSpinnerDrawn()).toBe(true);
    });

    it('REDUCED MOTION: the spinner is omitted and the text stands alone', async () => {
      jest.mocked(useReducedMotionPreference).mockReturnValue(true);
      await renderWithProviders(<ProductListFooterRow footer="loading-more" />);

      expect(screen.getByText(TEXT.es.loadingMore)).toBeOnTheScreen();
      expect(isSpinnerDrawn()).toBe(false);
    });

    it.each<Language>(['es', 'en'])('FAILED (%s): the products stay and "retry" fires', async (language) => {
      const onRetry = jest.fn();
      await renderWithProviders(<ProductListFooterRow footer="load-more-failed" onRetry={onRetry} />, { language });

      expect(screen.getByText(TEXT[language].loadMoreFailed)).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: TEXT[language].retry }));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });
});

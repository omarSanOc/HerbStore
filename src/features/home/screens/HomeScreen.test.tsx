/// <reference types="jest" />
// RF-4, RF-5 (T3a). Home in each state the user can meet: loading, content, nothing to show, server
// error and no connection, in Spanish and English. Every failure offers a retry that asks again;
// a loaded Home exposes categories and products as buttons. The double-tap rule of its buttons is
// in `navigation-taps.test.tsx`.
//
// Compose: a `sealed interface HomeUiState` rendered by `HomeScreen(state)` and one
// `composeTestRule` per case. SwiftUI: a preview per enum case, here asserted instead of eyeballed.
import { act, fireEvent, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { RETURN_FOCUS_DELAY_MS } from '@/core/accessibility/use-return-focus-to-opener';

import { createMockFetch, reply } from '@/test/mock-fetch';
import { setAppForeground } from '@/test/app-state';
import { resetRouterMock, router, setFocused } from '@/test/mock-expo-router';
import { emitReconnect, resetReconnectionMock } from '@/test/mock-reconnection';
import { renderWithProviders } from '@/test/render-with-providers';
import { wirePayload } from '@/features/home/testing/home-test-data';

import { HomeScreen } from './HomeScreen';

jest.mock('expo-router', () => jest.requireActual('@/test/mock-expo-router').expoRouterModule);
jest.mock('@/core/network/reconnection', () => jest.requireActual('@/test/mock-reconnection').reconnectionModule);

type Language = 'es' | 'en';

const TEXT = {
  es: {
    loading: 'Cargando Inicio',
    emptyTitle: 'Todavía no hay nada que mostrar',
    errorTitle: 'No se pudo cargar Inicio',
    offlineTitle: 'Sin conexión con el servidor',
    offlineNotice: 'Sin conexión. Se muestran los últimos datos recibidos.',
    failedNotice: 'No se pudo actualizar Inicio. Se muestran los últimos datos recibidos.',
    retry: 'Reintentar',
    sections: ['Más vendidos', 'Nuevos', 'Ofertas'],
    category: 'Vitaminas',
    search: 'Buscar productos',
    scan: 'Escanear un producto',
  },
  en: {
    loading: 'Loading Home',
    emptyTitle: 'Nothing to show yet',
    errorTitle: "Home couldn't be loaded",
    offlineTitle: 'No connection to the server',
    offlineNotice: 'You are offline. Showing the last data received.',
    failedNotice: 'Home could not be updated. Showing the last data received.',
    retry: 'Try again',
    sections: ['Best sellers', 'New', 'Offers'],
    category: 'Vitamins',
    search: 'Search products',
    scan: 'Scan a product',
  },
} as const;

const advance = (ms: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });

describe('HomeScreen states', () => {
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

  const homeRequests = () => mock.calls.filter(({ path }) => path === '/home');

  describe.each<Language>(['es', 'en'])('in %s', (language) => {
    const text = TEXT[language];

    it('LOADING: a busy, named placeholder and no retry', async () => {
      mock.enqueue('GET /home', reply.localized(wirePayload(language), language, { delayMs: 1_000 }));
      await renderWithProviders(<HomeScreen />, { language });

      expect(screen.getByLabelText(text.loading)).toBeBusy();
      expect(screen.queryByRole('button', { name: text.retry })).not.toBeOnTheScreen();

      await advance(1_010);
      expect(screen.queryByLabelText(text.loading)).not.toBeOnTheScreen();
    });

    it('CONTENT: the search entry, the categories and every section of products', async () => {
      mock.enqueue('GET /home', reply.localized(wirePayload(language), language));
      await renderWithProviders(<HomeScreen />, { language });
      await advance(10);

      expect(screen.getByRole('button', { name: text.search })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: text.category })).toBeOnTheScreen();
      for (const title of text.sections) {
        expect(screen.getByRole('header', { name: title })).toBeOnTheScreen();
      }
      expect(screen.getAllByRole('button', { name: /^Complete Daily Powder/ }).length).toBeGreaterThan(0);
    });

    // T6a. The scanner is a MODAL route. Closing it must give the screen-reader focus back to the
    // control that opened it ("Scan a product"), not leave it on the title TalkBack finds first.
    it('SCANNER: opens it, and once it closes the screen reader goes back to the scan button', async () => {
      mock.enqueue('GET /home', reply.localized(wirePayload(language), language));
      const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
      focus.mockClear();
      const view = await renderWithProviders(<HomeScreen />, { language });
      await advance(10);

      await fireEvent.press(screen.getByRole('button', { name: text.scan }));
      expect(router.push).toHaveBeenCalledWith('/scanner');

      // The modal covers Home (it loses navigation focus) and, once closed, gets it back.
      setFocused(false);
      await view.rerender(<HomeScreen />);
      setFocused(true);
      await view.rerender(<HomeScreen />);
      await advance(RETURN_FOCUS_DELAY_MS + 10);

      expect(focus).toHaveBeenCalledTimes(1);
      const target = focus.mock.calls[0]?.[0] as { props?: { accessibilityLabel?: string } };
      expect(target.props?.accessibilityLabel).toBe(text.scan);
    });

    it('EMPTY: says there is nothing (not an error) and still offers a retry', async () => {
      mock.enqueue('GET /home', reply.localized({ banners: [], categories: [], sections: [] }, language));
      await renderWithProviders(<HomeScreen />, { language });
      await advance(10);

      expect(screen.getByRole('header', { name: text.emptyTitle })).toBeOnTheScreen();
      expect(screen.queryByText(text.errorTitle)).not.toBeOnTheScreen();
      expect(screen.getByRole('button', { name: text.retry })).toBeOnTheScreen();
    });

    it('SERVER ERROR: after the GET retries it says so and "retry" asks again and recovers', async () => {
      mock.enqueue('GET /home', reply.serverError(), reply.serverError(), reply.serverError());
      await renderWithProviders(<HomeScreen />, { language });
      await advance(1_510);

      expect(homeRequests()).toHaveLength(3);
      expect(screen.getByRole('header', { name: text.errorTitle })).toBeOnTheScreen();
      expect(screen.queryByText(text.offlineTitle)).not.toBeOnTheScreen();

      mock.enqueue('GET /home', reply.localized(wirePayload(language), language));
      await fireEvent.press(screen.getByRole('button', { name: text.retry }));
      await advance(10);

      expect(homeRequests()).toHaveLength(4);
      expect(screen.getByRole('button', { name: text.search })).toBeOnTheScreen();
      expect(screen.queryByText(text.errorTitle)).not.toBeOnTheScreen();
    });

    it('OFFLINE: says there is no connection (not "error") and "retry" asks again', async () => {
      mock.enqueue('GET /home', reply.networkError(), reply.networkError(), reply.networkError());
      await renderWithProviders(<HomeScreen />, { language });
      await advance(1_510);

      expect(screen.getByRole('header', { name: text.offlineTitle })).toBeOnTheScreen();
      expect(screen.queryByText(text.errorTitle)).not.toBeOnTheScreen();

      mock.enqueue('GET /home', reply.localized(wirePayload(language), language));
      await fireEvent.press(screen.getByRole('button', { name: text.retry }));
      await advance(10);

      expect(homeRequests()).toHaveLength(4);
      expect(screen.getByRole('button', { name: text.search })).toBeOnTheScreen();
    });
  });

  // RF-17 (T3b). Home was loaded, time passed (>= 60 s, so the data is stale) and the device
  // reconnects: the background revalidation fails. The user keeps what was received and is told so;
  // it is NOT replaced by the error screen. The notice has a retry that recovers.
  describe.each<Language>(['es', 'en'])('PREVIOUS DATA after a failed revalidation, in %s', (language) => {
    const text = TEXT[language];

    async function loadThenGoStale() {
      mock.enqueue('GET /home', reply.localized(wirePayload(language), language));
      await renderWithProviders(<HomeScreen />, { language });
      await advance(10);
      expect(screen.getByRole('button', { name: text.search })).toBeOnTheScreen();
      await advance(61_000);
    }

    it('OFFLINE: keeps the content, warns "offline" (not the error screen) and "retry" recovers', async () => {
      await loadThenGoStale();
      mock.enqueue('GET /home', reply.networkError(), reply.networkError(), reply.networkError());

      await act(async () => {
        emitReconnect();
      });
      await advance(1_510);

      expect(homeRequests()).toHaveLength(4);
      expect(screen.getByText(text.offlineNotice)).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: text.search })).toBeOnTheScreen();
      expect(screen.queryByRole('header', { name: text.offlineTitle })).not.toBeOnTheScreen();

      mock.enqueue('GET /home', reply.localized(wirePayload(language), language));
      await fireEvent.press(screen.getByRole('button', { name: text.retry }));
      await advance(10);

      expect(homeRequests()).toHaveLength(5);
      expect(screen.queryByText(text.offlineNotice)).not.toBeOnTheScreen();
      expect(screen.getByRole('button', { name: text.search })).toBeOnTheScreen();
    });

    it('SERVER ERROR: keeps the content and says the update failed (not "offline")', async () => {
      await loadThenGoStale();
      mock.enqueue('GET /home', reply.serverError(), reply.serverError(), reply.serverError());

      await act(async () => {
        emitReconnect();
      });
      await advance(1_510);

      expect(screen.getByText(text.failedNotice)).toBeOnTheScreen();
      expect(screen.queryByText(text.offlineNotice)).not.toBeOnTheScreen();
      expect(screen.getByRole('button', { name: text.search })).toBeOnTheScreen();
    });

    it('FRESH data (< 60 s) is not requested again on reconnection: nothing can fail, nothing is warned', async () => {
      mock.enqueue('GET /home', reply.localized(wirePayload(language), language));
      await renderWithProviders(<HomeScreen />, { language });
      await advance(10);

      await act(async () => {
        emitReconnect();
      });
      await advance(2_000);

      expect(homeRequests()).toHaveLength(1);
      expect(screen.queryByText(text.offlineNotice)).not.toBeOnTheScreen();
    });
  });
});

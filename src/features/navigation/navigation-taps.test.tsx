/// <reference types="jest" />
// RF-4 (T3a). A double tap must navigate ONCE.
//   - M-6 (day 2): a fast double tap on "Back" / "Close" called `router.back()` twice, which pops two
//     screens instead of one.
//   - Day 5 (T6): two taps ~100 ms apart on a button whose route is singular
//     (`dangerouslySingular`) stacked two screens; also in Search.
//
// The router is the explicit mock of `@/test/mock-expo-router`: what we can check from Jest is how
// many times OUR code asks the router to navigate. How the real stack reacts to those calls is
// expo-router's job and is confirmed on devices (the manual steps are in the T3a report).
//
// The user's tap is a press on the control found by role and name, like a TalkBack/VoiceOver user.
// Compose: `performClick()` twice on `onNodeWithContentDescription("Back")`. XCUITest:
// `app.buttons["Back"].tap()` twice.
import { act, fireEvent, screen } from '@testing-library/react-native';

import { createTestStore, startPersistence, wireProductPage } from '@/test/fixtures';
import { createMockFetch, reply } from '@/test/mock-fetch';
import { resetRouterMock, router } from '@/test/mock-expo-router';
import { renderWithProviders } from '@/test/render-with-providers';
import { productAdded } from '@/features/cart/store/cart-slice';
import { CartScreen } from '@/features/cart/screens/CartScreen';
import { AccountScreen } from '@/features/account/screens/AccountScreen';
import { CategoryProductsScreen } from '@/features/categories/screens/CategoryProductsScreen';
import { HomeScreen } from '@/features/home/screens/HomeScreen';
import { wirePayload } from '@/features/home/testing/home-test-data';
import { NotFoundScreen } from '@/features/navigation/screens/NotFoundScreen';
import { ScannerHeaderCloseButton } from '@/features/scanner/components/ScannerHeaderCloseButton';
import { SearchScreen } from '@/features/search/screens/SearchScreen';

jest.mock('expo-router', () => jest.requireActual('@/test/mock-expo-router').expoRouterModule);
jest.mock('@/core/network/reconnection', () => ({ onReconnect: () => () => undefined }));

/** A real user cannot tap twice in the same millisecond: ~100 ms apart is the measured case. */
const DOUBLE_TAP_GAP_MS = 100;
/** Long enough for any reasonable lockout to be over: the next, deliberate tap must work again. */
const A_LATER_TAP_MS = 2_000;

const advance = (ms: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });

async function doubleTap(control: Parameters<typeof fireEvent.press>[0]) {
  await fireEvent.press(control);
  await advance(DOUBLE_TAP_GAP_MS);
  await fireEvent.press(control);
}

describe('double tap navigates once', () => {
  let mock: ReturnType<typeof createMockFetch>;

  beforeEach(() => {
    jest.useFakeTimers();
    resetRouterMock();
    mock = createMockFetch();
    mock.install();
  });

  afterEach(() => {
    mock.uninstall();
  });

  describe('M-6: Back and Close', () => {
    it('"Volver" of the not-found screen goes back one screen, not two', async () => {
      await renderWithProviders(<NotFoundScreen />);

      await doubleTap(screen.getByRole('button', { name: 'Volver' }));

      expect(router.back).toHaveBeenCalledTimes(1);
      expect(router.replace).not.toHaveBeenCalled();
    });

    it('"Cerrar" of the scanner header closes the modal once', async () => {
      await renderWithProviders(<ScannerHeaderCloseButton />);

      await doubleTap(screen.getByRole('button', { name: 'Cerrar' }));

      expect(router.back).toHaveBeenCalledTimes(1);
    });

    it('with no history (deep link) a double tap replaces with Home once', async () => {
      router.canGoBack.mockReturnValue(false);
      await renderWithProviders(<NotFoundScreen />, { language: 'en' });

      await doubleTap(screen.getByRole('button', { name: 'Go back' }));

      expect(router.replace).toHaveBeenCalledTimes(1);
      expect(router.replace).toHaveBeenCalledWith('/');
      expect(router.back).not.toHaveBeenCalled();
    });

    it('is not a permanent lock: a later, deliberate tap goes back again', async () => {
      await renderWithProviders(<NotFoundScreen />);
      const back = screen.getByRole('button', { name: 'Volver' });

      await fireEvent.press(back);
      await advance(A_LATER_TAP_MS);
      await fireEvent.press(back);

      expect(router.back).toHaveBeenCalledTimes(2);
    });
  });

  describe('buttons whose route is singular', () => {
    it('Home: the search field opens Search once', async () => {
      mock.always('GET /home', reply.success(wirePayload()));
      await renderWithProviders(<HomeScreen />);

      await doubleTap(screen.getByRole('button', { name: 'Buscar productos' }));

      expect(router.push).toHaveBeenCalledTimes(1);
      expect(router.push).toHaveBeenCalledWith('/search');
    });

    it('Home: the scan button opens the scanner once', async () => {
      mock.always('GET /home', reply.success(wirePayload()));
      await renderWithProviders(<HomeScreen />);

      await doubleTap(screen.getByRole('button', { name: 'Escanear un producto' }));

      expect(router.push).toHaveBeenCalledTimes(1);
      expect(router.push).toHaveBeenCalledWith('/scanner');
    });

    it('Home: two taps on category chips open ONE category', async () => {
      mock.always('GET /home', reply.success(wirePayload()));
      await renderWithProviders(<HomeScreen />);
      await advance(10);

      await fireEvent.press(screen.getByRole('button', { name: 'Vitaminas' }));
      await advance(DOUBLE_TAP_GAP_MS);
      // A second finger on ANOTHER card: the screen must still open a single destination.
      await fireEvent.press(screen.getByRole('button', { name: 'Minerales' }));

      expect(router.push).toHaveBeenCalledTimes(1);
      expect(router.push).toHaveBeenCalledWith({ pathname: '/category/[id]', params: { id: 'vitamins' } });
    });

    it('Search: a double tap on a result opens ONE product', async () => {
      mock.always('GET /products', reply.success(wireProductPage(3)));
      await renderWithProviders(<SearchScreen />);
      await fireEvent.changeText(screen.getByLabelText('Buscar productos'), 'powder');
      await advance(450); // the 400 ms debounce, then the response
      await advance(10);

      const card = screen.getAllByRole('button', { name: /^Complete Daily Powder 001/ })[0];
      await doubleTap(card);

      expect(router.push).toHaveBeenCalledTimes(1);
      expect(router.push).toHaveBeenCalledWith({ pathname: '/product/[id]', params: { id: 'product-261009-001' } });
    });

    it('Category: a double tap on a product opens ONE product', async () => {
      mock.always('GET /products', reply.success(wireProductPage(3)));
      await renderWithProviders(<CategoryProductsScreen rawId="vitamins" />);
      await advance(10);

      const card = screen.getAllByRole('button', { name: /^Complete Daily Powder 001/ })[0];
      await doubleTap(card);

      expect(router.push).toHaveBeenCalledTimes(1);
    });

    it('Account: a double tap on "Fundamentos" opens it once', async () => {
      await renderWithProviders(<AccountScreen />);

      await doubleTap(screen.getByRole('button', { name: /Fundamentos/ }));

      expect(router.push).toHaveBeenCalledTimes(1);
      expect(router.push).toHaveBeenCalledWith('/foundations');
    });

    it('Account: one tap on each of the two buttons within the window opens ONE screen', async () => {
      await renderWithProviders(<AccountScreen />);

      await fireEvent.press(screen.getByRole('button', { name: /Fundamentos/ }));
      await advance(DOUBLE_TAP_GAP_MS);
      await fireEvent.press(screen.getByRole('button', { name: /DeviceInsights/ }));

      expect(router.push).toHaveBeenCalledTimes(1);
    });

    it('is not a permanent lock: after the window the same button navigates again', async () => {
      mock.always('GET /home', reply.success(wirePayload()));
      await renderWithProviders(<HomeScreen />);
      const search = screen.getByRole('button', { name: 'Buscar productos' });

      await fireEvent.press(search);
      await advance(A_LATER_TAP_MS);
      await fireEvent.press(search);

      expect(router.push).toHaveBeenCalledTimes(2);
    });
  });

  describe('Cart: "Continuar al checkout" (T3b)', () => {
    const PRODUCT = { productId: 'product-261009-001', name: 'Complete Daily Powder 001', unitPrice: 100, currency: 'MXN' as const, stock: 5 };

    async function mountCart() {
      const store = createTestStore();
      await startPersistence(store).rehydrated;
      store.dispatch(productAdded({ product: PRODUCT, quantity: 2 }));
      await renderWithProviders(<CartScreen />, { store });
      return screen.getByRole('button', { name: 'Continuar al checkout' });
    }

    it('a double tap opens the checkout ONCE', async () => {
      const checkout = await mountCart();

      await doubleTap(checkout);

      expect(router.push).toHaveBeenCalledTimes(1);
      expect(router.push).toHaveBeenCalledWith('/(tabs)/(cart)/checkout');
    });

    it('is not a permanent lock: after the window the same button navigates again', async () => {
      const checkout = await mountCart();

      await fireEvent.press(checkout);
      await advance(A_LATER_TAP_MS);
      await fireEvent.press(checkout);

      expect(router.push).toHaveBeenCalledTimes(2);
    });
  });
});

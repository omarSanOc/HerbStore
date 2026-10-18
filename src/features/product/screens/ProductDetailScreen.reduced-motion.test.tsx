/// <reference types="jest" />
// RF-15 (spec 006, T6c). "Loading product…" is a state with its own title. With reduced motion the spinner
// is left out and the title stands alone (the product list footer does the same since Day 3); the
// accessible name of the state is the same with or without it.
//
// Compose: `CircularProgressIndicator` guarded by a reduce-motion check; SwiftUI: `ProgressView` shown only
// when `!accessibilityReduceMotion`.
import { act, screen } from '@testing-library/react-native';

import { useReducedMotionPreference } from '@/core/accessibility/use-reduced-motion';
import { setAppForeground } from '@/test/app-state';
import { createTestStore, startPersistence, wireProduct } from '@/test/fixtures';
import { createMockFetch, reply } from '@/test/mock-fetch';
import { resetRouterMock } from '@/test/mock-expo-router';
import { resetReconnectionMock } from '@/test/mock-reconnection';
import { renderWithProviders } from '@/test/render-with-providers';

import { ProductDetailScreen } from './ProductDetailScreen';

jest.mock('expo-router', () => jest.requireActual('@/test/mock-expo-router').expoRouterModule);
jest.mock('@/core/network/reconnection', () => jest.requireActual('@/test/mock-reconnection').reconnectionModule);
jest.mock('@/core/accessibility/use-reduced-motion', () => ({ useReducedMotionPreference: jest.fn(() => false) }));

const ID = 'product-261009-001';
const isSpinnerDrawn = () => JSON.stringify(screen.toJSON()).includes('"type":"ActivityIndicator"');

describe('ProductDetailScreen loading and reduced motion', () => {
  let mock: ReturnType<typeof createMockFetch>;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.mocked(useReducedMotionPreference).mockReturnValue(false);
    resetRouterMock();
    resetReconnectionMock();
    setAppForeground();
    mock = createMockFetch();
    mock.install();
    mock.enqueue(`GET /products/${ID}`, reply.success(wireProduct(1, { stock: 5, inStock: true })));
  });

  afterEach(async () => {
    // Let the pending request finish before the environment goes away.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(50);
    });
    mock.uninstall();
  });

  async function renderLoading() {
    const store = createTestStore();
    await startPersistence(store).rehydrated;
    await renderWithProviders(<ProductDetailScreen rawId={ID} />, { store });
  }

  it('WITH MOTION: a spinner and the title', async () => {
    await renderLoading();

    expect(isSpinnerDrawn()).toBe(true);
    expect(screen.getByLabelText('Cargando producto…')).toBeOnTheScreen();
  });

  it('REDUCED MOTION: no spinner; the title stands alone and says the same', async () => {
    jest.mocked(useReducedMotionPreference).mockReturnValue(true);
    await renderLoading();

    expect(isSpinnerDrawn()).toBe(false);
    expect(screen.getByText('Cargando producto…')).toBeOnTheScreen();
  });
});

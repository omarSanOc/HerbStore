/// <reference types="jest" />
// RF-16 (T6d). Measured reason (docs/evidence/day-6-performance.md): changing the quantity of ONE
// cart line rendered every line (3 taps x 3 lines = 36 `CartLine` renders on the Samsung for 12
// taps, 12 expected). The lines that did not change must not render again.
//
// Compose: `key(productId)` inside a `LazyColumn` + stable parameters (the composable is skipped).
// SwiftUI: `ForEach(lines)` over `Identifiable` + `Equatable` rows (`.equatable()`).
import { act, fireEvent, screen } from '@testing-library/react-native';

import { productAdded } from '@/features/cart/store/cart-slice';
import { createTestStore, startPersistence } from '@/test/fixtures';
import { resetRouterMock } from '@/test/mock-expo-router';
import { renderWithProviders } from '@/test/render-with-providers';

import { CartScreen } from './CartScreen';

jest.mock('expo-router', () => jest.requireActual('@/test/mock-expo-router').expoRouterModule);

const renderedLines: string[] = [];

// Counts one entry per execution of `CartLine`, with the product it draws.
jest.mock('../components/CartLine', () => {
  const actual = jest.requireActual('../components/CartLine');
  return {
    CartLine: (props: { item: { line: { productId: string } } }) => {
      renderedLines.push(props.item.line.productId);
      return actual.CartLine(props);
    },
  };
});

const product = (n: number) => ({
  productId: `product-261009-00${n}`,
  name: `Complete Daily Powder 00${n}`,
  unitPrice: 100,
  currency: 'MXN' as const,
  stock: 9,
});

describe('CartScreen renders', () => {
  beforeEach(() => {
    resetRouterMock();
    renderedLines.length = 0;
  });

  it('changing the quantity of one line renders only that line again', async () => {
    const store = createTestStore();
    await startPersistence(store).rehydrated;
    await act(async () => {
      for (const n of [1, 2, 3]) store.dispatch(productAdded({ product: product(n), quantity: 1 }));
    });
    await renderWithProviders(<CartScreen />, { language: 'en', store });
    expect([...new Set(renderedLines)]).toHaveLength(3);

    renderedLines.length = 0;
    await fireEvent.press(screen.getByLabelText('Increase quantity of Complete Daily Powder 002'));

    expect(renderedLines).toEqual(['product-261009-002']);
  });
});

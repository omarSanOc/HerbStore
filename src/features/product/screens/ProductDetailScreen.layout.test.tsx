/// <reference types="jest" />
// RF-15 (T6b, Day 5 T7). The failed-share message appears UNDER the Share button, and at a large font
// that button can be right above the bar pinned to the bottom, so the message (and its retry) used to
// land under the bar: the retry button was not on screen at Android 2.0. Now it is scrolled into sight
// when it appears, and the pair is capped (`fontScaleLimits.inlineFeedback`) so it fits the visible
// part of the screen even at iOS AX5.
//
// Compose: `BringIntoViewRequester` on the message. SwiftUI: `ScrollViewReader.scrollTo(id)`.
import { act, fireEvent, screen } from '@testing-library/react-native';
import { ScrollView, Share, View } from 'react-native';

import { useReducedMotionPreference } from '@/core/accessibility/use-reduced-motion';
import { fontScaleLimits } from '@/design-system';
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
const ROUTE = `GET /products/${ID}`;
/** The visible part of the scroll view: the screen minus the bar pinned under it. */
const VIEWPORT = 400;

describe('ProductDetailScreen: the failed-share message at a large font', () => {
  let mock: ReturnType<typeof createMockFetch>;
  let scrollTo: jest.SpyInstance;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.mocked(useReducedMotionPreference).mockReturnValue(false);
    resetRouterMock();
    resetReconnectionMock();
    setAppForeground();
    mock = createMockFetch();
    mock.install();
    // Shared `jest.fn`s of the mocked classes (see `QuickFilters.test.tsx`): cleared by hand.
    scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo').mockReset();
    jest.spyOn(View.prototype, 'measureLayout').mockReset();

    mock.enqueue(ROUTE, reply.success(wireProduct(1, { stock: 3, inStock: true })));
    const store = createTestStore();
    await startPersistence(store).rehydrated;
    await renderWithProviders(<ProductDetailScreen rawId={ID} />, { language: 'en', store });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10);
    });
    jest.spyOn(Share, 'share').mockRejectedValueOnce(new Error('no sheet'));
  });

  afterEach(() => {
    mock.uninstall();
  });

  /** The layout would put the message at `top` (height 200) inside the scroll content. */
  const messageAt = (top: number) => {
    jest.spyOn(View.prototype, 'measureLayout').mockImplementation(((_relativeTo: unknown, onSuccess: (...args: number[]) => void) => {
      onSuccess(0, top, 300, 200);
    }) as never);
  };

  const layout = (height: number, y = 0) => ({ nativeEvent: { layout: { x: 0, y, width: 300, height } } });

  /** The scroll view reports its visible height, then the failed share puts the message on screen. */
  const failShare = async () => {
    await fireEvent(screen.getByTestId('product-detail-scroll'), 'layout', layout(VIEWPORT));
    await fireEvent.press(screen.getByRole('button', { name: 'Share' }));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10);
    });
  };

  it('is scrolled into sight when it lands under the pinned bar', async () => {
    messageAt(900);
    await failShare();

    // Its layout event is what asks for it: its end (900 + 200) plus the 16 dp margin must fit the 400 dp viewport.
    await fireEvent(screen.getByTestId('product-share-error'), 'layout', layout(200, 900));

    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ y: 900 + 200 + 16 - VIEWPORT, animated: true });
  });

  it('REDUCED MOTION (RF-15): it is scrolled to the same place, without the slide', async () => {
    jest.mocked(useReducedMotionPreference).mockReturnValue(true);
    messageAt(900);
    await failShare();

    await fireEvent(screen.getByTestId('product-share-error'), 'layout', layout(200, 900));

    expect(scrollTo).toHaveBeenCalledWith({ y: 900 + 200 + 16 - VIEWPORT, animated: false });
  });

  it('is left where it is when it already shows above the bar', async () => {
    messageAt(100);
    await failShare();

    await fireEvent(screen.getByTestId('product-share-error'), 'layout', layout(200, 100));

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('caps the font scale of the message and of its retry button, so the pair fits above the bar at AX5', async () => {
    await failShare();

    expect(screen.getByText('The product could not be shared. Try again.')).toHaveProp(
      'maxFontSizeMultiplier',
      fontScaleLimits.inlineFeedback,
    );
    expect(screen.getByText('Try sharing again')).toHaveProp('maxFontSizeMultiplier', fontScaleLimits.inlineFeedback);
    expect(fontScaleLimits.inlineFeedback).toBeLessThanOrEqual(2);
  });
});

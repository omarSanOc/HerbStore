/// <reference types="jest" />
// RF-15 (spec 006, T6c). The banner carousel with reduced motion: it does not advance by itself (the
// autoplay is a movement the user did not ask for) and the buttons and the screen reader's increment
// JUMP to the next banner instead of sliding. Without the preference the same banner advances after 5 s,
// which is what makes the first assertion mean something.
//
// Android: `ANIMATOR_DURATION_SCALE` = 0; iOS: `UIAccessibility.isReduceMotionEnabled`;
// Compose: `HorizontalPager` + `animateScrollToPage` vs `scrollToPage`; SwiftUI: `withAnimation(reduceMotion ? nil : .default)`.
import { act, fireEvent, screen } from '@testing-library/react-native';
import { FlatList } from 'react-native';

import { useReducedMotionPreference } from '@/core/accessibility/use-reduced-motion';
import { setAppForeground } from '@/test/app-state';
import { resetRouterMock } from '@/test/mock-expo-router';
import { renderWithProviders } from '@/test/render-with-providers';

import type { HomeBanner } from '../contracts/home';
import { AUTOPLAY_INTERVAL_MS } from '../carousel/carousel-autoplay';
import { BannerCarousel } from './BannerCarousel';

jest.mock('expo-router', () => jest.requireActual('@/test/mock-expo-router').expoRouterModule);
jest.mock('@/core/accessibility/use-reduced-motion', () => ({ useReducedMotionPreference: jest.fn(() => false) }));

const banners: readonly HomeBanner[] = [
  { id: 'daily-wellness', title: 'Daily wellness essentials', subtitle: 'Explore.', imageUrl: '/images/banners/a.png', categoryId: 'vitamins' },
  { id: 'plant-powered', title: 'Plant-powered collection', subtitle: 'Discover.', imageUrl: '/images/banners/b.png', categoryId: 'botanicals' },
];

async function renderCarousel() {
  const view = await renderWithProviders(<BannerCarousel banners={banners} isRowVisible onOpenCategory={jest.fn()} />);
  // The carousel pages by its own measured width: nothing scrolls until it has one.
  await fireEvent(screen.getByRole('adjustable'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 200 } } });
  return view;
}

const position = () => screen.getByRole('adjustable').props.accessibilityValue.text as string;

const advance = (ms: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });

describe('BannerCarousel and reduced motion', () => {
  let scrollToOffset: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    setAppForeground();
    resetRouterMock();
    jest.mocked(useReducedMotionPreference).mockReturnValue(false);
    scrollToOffset = jest.spyOn(FlatList.prototype, 'scrollToOffset').mockImplementation(() => {});
  });

  // RF-8, RF-22 (spec 007, T3). The title and the subtitle are COPY OF THE CATALOG: they come from
  // the localized payload, never from a local table keyed by the banner id. `daily-wellness` IS one
  // of the ids that used to have a translation, so this assertion fails while the table exists.
  //
  // Android: string resources keyed by server id would drift from the backend; SwiftUI: a
  // `Localizable` entry per server id has the same problem. The text belongs to the response.
  it('RF-8: it shows the title and the subtitle the API sent, not a local translation of the id', async () => {
    const known: readonly HomeBanner[] = [
      { id: 'daily-wellness', title: 'Daily wellness essentials', subtitle: 'Explore.', imageUrl: '/images/banners/a.png', categoryId: 'vitamins' },
    ];
    await renderWithProviders(<BannerCarousel banners={known} isRowVisible onOpenCategory={jest.fn()} />);

    expect(screen.getByText('Daily wellness essentials')).toBeOnTheScreen();
    expect(screen.getByText('Explore.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Daily wellness essentials. Explore.' })).toBeOnTheScreen();
  });

  it('WITH MOTION: it advances to the next banner by itself after 5 s, animated', async () => {
    await renderCarousel();
    const first = position();
    scrollToOffset.mockClear();

    await advance(AUTOPLAY_INTERVAL_MS + 100);

    expect(position()).not.toBe(first);
    expect(scrollToOffset).toHaveBeenCalledWith({ offset: 300, animated: true });
  });

  it('REDUCED MOTION: it does not advance by itself, however long the user waits', async () => {
    jest.mocked(useReducedMotionPreference).mockReturnValue(true);
    await renderCarousel();
    const first = position();
    scrollToOffset.mockClear();

    await advance(AUTOPLAY_INTERVAL_MS * 4);

    expect(position()).toBe(first);
    expect(scrollToOffset).not.toHaveBeenCalled();
  });

  it('REDUCED MOTION: the next button jumps to the next banner (not animated) and the result is the same', async () => {
    jest.mocked(useReducedMotionPreference).mockReturnValue(true);
    await renderCarousel();
    const first = position();
    scrollToOffset.mockClear();

    await fireEvent.press(screen.getByRole('button', { name: 'Banner siguiente' }));

    expect(position()).not.toBe(first);
    expect(scrollToOffset).toHaveBeenCalledWith({ offset: 300, animated: false });
  });

  it('REDUCED MOTION: the screen reader\'s "increment" action jumps too', async () => {
    jest.mocked(useReducedMotionPreference).mockReturnValue(true);
    await renderCarousel();
    scrollToOffset.mockClear();

    await fireEvent(screen.getByRole('adjustable'), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });

    expect(scrollToOffset).toHaveBeenCalledWith({ offset: 300, animated: false });
  });

  it('WITH MOTION: the next button slides (the contrast of the previous test)', async () => {
    await renderCarousel();
    scrollToOffset.mockClear();

    await fireEvent.press(screen.getByRole('button', { name: 'Banner siguiente' }));

    expect(scrollToOffset).toHaveBeenCalledWith({ offset: 300, animated: true });
  });
});

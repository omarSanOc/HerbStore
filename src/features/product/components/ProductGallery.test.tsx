/// <reference types="jest" />
// RF-15 (spec 006, T6c). The product gallery with reduced motion: the screen reader's increment and
// decrement gestures JUMP to the next picture instead of sliding, and land in the same place as
// without the preference. (The gallery has no autoplay; a swipe by hand is the user's own movement.)
//
// Android: `ANIMATOR_DURATION_SCALE` = 0; iOS: `UIAccessibility.isReduceMotionEnabled`;
// Compose: `PagerState.scrollToPage` vs `animateScrollToPage`.
import { fireEvent, screen } from '@testing-library/react-native';
import { ScrollView } from 'react-native';

import { useReducedMotionPreference } from '@/core/accessibility/use-reduced-motion';
import { renderWithProviders } from '@/test/render-with-providers';

import { ProductGallery } from './ProductGallery';

jest.mock('@/core/accessibility/use-reduced-motion', () => ({ useReducedMotionPreference: jest.fn(() => false) }));

const images = ['/images/products/a-front.png', '/images/products/a-detail.png', '/images/products/a-side.png'];

async function renderGallery() {
  await renderWithProviders(<ProductGallery images={images} name="Complete Daily Powder" />);
  await fireEvent(screen.getByRole('adjustable'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 300 } } });
}

const increment = () =>
  fireEvent(screen.getByRole('adjustable'), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });

describe('ProductGallery and reduced motion', () => {
  let scrollTo: jest.SpyInstance;

  beforeEach(() => {
    jest.mocked(useReducedMotionPreference).mockReturnValue(false);
    scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo').mockReset();
  });

  it('WITH MOTION: "increment" slides to the next picture', async () => {
    await renderGallery();
    const first = screen.getByRole('adjustable').props.accessibilityValue.text;
    scrollTo.mockClear();

    await increment();

    expect(scrollTo).toHaveBeenCalledWith({ x: 300, animated: true });
    expect(screen.getByRole('adjustable').props.accessibilityValue.text).not.toBe(first);
  });

  it('REDUCED MOTION: "increment" jumps to the same picture, without sliding', async () => {
    jest.mocked(useReducedMotionPreference).mockReturnValue(true);
    await renderGallery();
    const first = screen.getByRole('adjustable').props.accessibilityValue.text;
    scrollTo.mockClear();

    await increment();

    expect(scrollTo).toHaveBeenCalledWith({ x: 300, animated: false });
    expect(screen.getByRole('adjustable').props.accessibilityValue.text).not.toBe(first);
  });
});

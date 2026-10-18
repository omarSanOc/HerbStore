/// <reference types="jest" />
// RF-15 (T6b, H-12). The loading card must be as tall as the real one at the CURRENT font scale: the
// scale only multiplies text, so fixed-height bars made the skeleton a fraction of the card at 2.0
// and the page jumped when the data arrived.
//
// Compose: a `Modifier.height(with(LocalDensity.current) { 20.sp.toDp() })` placeholder.
// SwiftUI: `@ScaledMetric` heights in a `redacted(reason: .placeholder)` card.
import { screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { mockFontScale } from '@/test/font-scale';
import { renderWithProviders } from '@/test/render-with-providers';

import { ProductCardSkeleton } from './ProductCardSkeleton';

/** Height of one placeholder line, from the style the card gives it. */
function lineHeights(): number[] {
  return screen
    .getAllByTestId('product-card-skeleton-line')
    .map((line) => StyleSheet.flatten(line.props.style).height as number);
}

describe('ProductCardSkeleton', () => {
  it('draws four text lines of the label height at the default font scale', async () => {
    mockFontScale(1);
    await renderWithProviders(<ProductCardSkeleton />);

    expect(lineHeights()).toEqual([20, 20, 20, 20]);
  });

  it.each([
    [1.5, 30],
    [2, 40],
  ])('makes every line as tall as the text at %sx (Android 1.5 / 2.0)', async (fontScale, expected) => {
    mockFontScale(fontScale);
    await renderWithProviders(<ProductCardSkeleton />);

    expect(lineHeights()).toEqual([expected, expected, expected, expected]);
  });

  it('keeps pace with iOS AX5 (about 3.1x) instead of stopping at the 1x height', async () => {
    mockFontScale(3.1);
    await renderWithProviders(<ProductCardSkeleton />);

    expect(Math.min(...lineHeights())).toBeGreaterThanOrEqual(62);
  });

  it('never shrinks under a font smaller than the default', async () => {
    mockFontScale(0.85);
    await renderWithProviders(<ProductCardSkeleton />);

    expect(lineHeights()).toEqual([20, 20, 20, 20]);
  });

  it('takes the width Home gives it, or fills its grid cell', async () => {
    mockFontScale(1);
    await renderWithProviders(<ProductCardSkeleton width={240} />);
    expect(StyleSheet.flatten(screen.getByTestId('product-card-skeleton').props.style).width).toBe(240);
  });
});

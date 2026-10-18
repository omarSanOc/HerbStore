/// <reference types="jest" />
// RF-15 (T6b, H-12). Home's loading placeholder reserves what the rows will take at the CURRENT font
// scale: the line under each category, the section title and the card (its width grows with the
// font up to 1.5x, its text lines are as tall as the text). At 2.0 they used to be a fraction of
// the real rows and the page jumped when the data arrived.
//
// Compose: placeholders measured in `sp`. SwiftUI: `@ScaledMetric` sizes in a redacted view.
import { screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { mockFontScale } from '@/test/font-scale';
import { renderWithProviders } from '@/test/render-with-providers';

import { HomeSkeleton } from './HomeSkeleton';

const style = (testID: string) =>
  screen.getAllByTestId(testID).map((node) => StyleSheet.flatten(node.props.style));

describe('HomeSkeleton', () => {
  it('is ONE busy, named element (not a pile of empty views)', async () => {
    mockFontScale(1);
    await renderWithProviders(<HomeSkeleton />);

    expect(screen.getByLabelText('Cargando Inicio')).toBeBusy();
  });

  it('reserves the default heights and the 160 pt card at the default font scale', async () => {
    mockFontScale(1);
    await renderWithProviders(<HomeSkeleton />);

    expect(style('home-skeleton-category-label')[0].height).toBe(20);
    expect(style('home-skeleton-section-title')[0].height).toBe(26);
    expect(style('product-card-skeleton')[0].width).toBe(160);
    expect(style('product-card-skeleton-line')[0].height).toBe(20);
  });

  it('grows with the text at 2.0: label and title lines, card width (capped at 1.5x) and card lines', async () => {
    mockFontScale(2);
    await renderWithProviders(<HomeSkeleton />);

    expect(style('home-skeleton-category-label')[0].height).toBe(40);
    expect(style('home-skeleton-section-title')[0].height).toBe(52);
    expect(style('product-card-skeleton')[0].width).toBe(240);
    expect(style('product-card-skeleton-line')[0].height).toBe(40);
  });
});

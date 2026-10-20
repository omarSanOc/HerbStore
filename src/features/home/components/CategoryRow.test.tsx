/// <reference types="jest" />
// RF-15 (T6b, H-7). The labels of Home's category row stay a separation apart as the text grows: a
// constant 8 dp equals one word space at 2.0, so "Vitamins Minerals Protein" read as one sentence.
//
// Compose: `Arrangement.spacedBy` measured in `sp`. SwiftUI: an `@ScaledMetric` spacing.
import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { mockFontScale } from '@/test/font-scale';
import { renderWithProviders } from '@/test/render-with-providers';

import { CategoryRow } from './CategoryRow';

const categories = [
  { id: 'vitamins', name: 'Vitamins', productCount: 10, imageUrl: '/images/categories/vitamins.png' },
  { id: 'minerals', name: 'Minerals', productCount: 10, imageUrl: '/images/categories/minerals.png' },
];

/** The gap the row puts between two categories: the `gap` of its content container. */
function rowGap(): number {
  return StyleSheet.flatten(screen.getByTestId('category-row').props.contentContainerStyle).gap as number;
}

describe('CategoryRow', () => {
  it('keeps the 8 dp gap at the default font scale', async () => {
    mockFontScale(1);
    await renderWithProviders(<CategoryRow categories={categories} onOpenCategory={jest.fn()} />);

    expect(rowGap()).toBe(8);
  });

  it.each([
    [1.5, 12],
    [2, 16],
  ])('grows the gap with the text: %sx -> %s dp', async (fontScale, gap) => {
    mockFontScale(fontScale);
    await renderWithProviders(<CategoryRow categories={categories} onOpenCategory={jest.fn()} />);

    expect(rowGap()).toBe(gap);
  });

  // RF-8, RF-22 (spec 007, T3). The visible name is the one the API sent in the localized payload
  // (`Vitamins` here), even for `vitamins`, an id that used to have a Spanish translation: the app
  // no longer substitutes copy of the catalog by id.
  it('RF-8: each category shows the name the API sent and opens it', async () => {
    mockFontScale(2);
    const onOpenCategory = jest.fn();
    await renderWithProviders(<CategoryRow categories={categories} onOpenCategory={onOpenCategory} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Vitamins' }));
    expect(onOpenCategory).toHaveBeenCalledWith('vitamins');
  });
});

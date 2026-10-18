/// <reference types="jest" />
// RF-15 (T6b, G-4/S-8 and the selected chip). The bar pinned above a product list at a large font:
//   - the Sort and Filters buttons share ONE group no wider than the row, whose items shrink, so
//     neither can end past the screen edge (at iOS AX5 "Filters" was not on screen at all);
//   - everything in the bar scales only up to `fontScaleLimits.filterBar`, so a pinned bar does not
//     take a fifth of the screen;
//   - the targets keep their 48 dp, and a chip that has just been turned on is scrolled into sight
//     when its new width (the check mark) makes it end past the edge.
//
// Compose: `LazyRow` + `Row(Modifier.weight(1f, fill = false))` + `LazyListState.animateScrollToItem`.
// SwiftUI: `ScrollViewReader.scrollTo(id)` in a horizontal `ScrollView`.
import { fireEvent, screen } from '@testing-library/react-native';
import { Dimensions, ScrollView, StyleSheet, View } from 'react-native';

import { useReducedMotionPreference } from '@/core/accessibility/use-reduced-motion';
import { AppButton, fontScaleLimits } from '@/design-system';
import { renderWithProviders } from '@/test/render-with-providers';

import { DEFAULT_LIST_PARAMS } from '../logic/list-params';
import { QuickFilters } from './QuickFilters';

jest.mock('@/core/accessibility/use-reduced-motion', () => ({ useReducedMotionPreference: jest.fn(() => false) }));

const leading = [
  { key: 'sort', node: <AppButton accessibilityHint="h" label="Ordenar: Destacados" maxFontSizeMultiplier={fontScaleLimits.filterBar} onPress={jest.fn()} /> },
  { key: 'advanced', node: <AppButton accessibilityHint="h" label="Filtros" maxFontSizeMultiplier={fontScaleLimits.filterBar} onPress={jest.fn()} /> },
];

const renderBar = (onToggle = jest.fn()) =>
  renderWithProviders(<QuickFilters leading={leading} onToggle={onToggle} params={DEFAULT_LIST_PARAMS} />);

const layout = (width: number, height = 60) => ({ nativeEvent: { layout: { x: 0, y: 0, width, height } } });

describe('QuickFilters', () => {
  it('puts Sort and Filters in one group no wider than the row, with items that shrink (G-4/S-8)', async () => {
    await renderBar();

    const group = screen.getByTestId('quick-filters-leading');
    // The row shows the window minus a 16 dp gutter on each side.
    expect(StyleSheet.flatten(group.props.style).maxWidth).toBe(Dimensions.get('window').width - 32);
    expect(StyleSheet.flatten(group.props.style).flexDirection).toBe('row');
    // Only the FIRST item (the sort button, whose text changes with the option) gives width back. If both
    // shrank in proportion, the short word of the second one ("Filtros") was split in the middle at iOS
    // AX5 ("Filtro / s"): a word never wraps, so a short item must keep the width of its longest word.
    const items = (group as unknown as { children: readonly unknown[] }).children;
    expect(items).toHaveLength(2);
    const shrinks = items.map((item) => {
      expect(typeof item).not.toBe('string');
      return (StyleSheet.flatten((item as unknown as { props: { style: unknown } }).props.style) as { flexShrink?: number }).flexShrink;
    });
    expect(shrinks).toEqual([1, 0]);
    expect(screen.getByRole('button', { name: 'Ordenar: Destacados' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Filtros' })).toBeOnTheScreen();
  });

  it('caps the font scale of the buttons and of every chip, so the pinned bar stays short', async () => {
    await renderBar();

    for (const label of ['Ordenar: Destacados', 'Filtros', 'Disponible', '4★ o más', 'Marca propia']) {
      expect(screen.getByText(label)).toHaveProp('maxFontSizeMultiplier', fontScaleLimits.filterBar);
    }
    expect(fontScaleLimits.filterBar).toBeLessThanOrEqual(1.5);
  });

  it('every chip keeps a target of at least 48 dp', async () => {
    await renderBar();

    for (const label of ['Disponible', '4★ o más', 'Marca propia', 'Suscríbete y ahorra']) {
      const style = StyleSheet.flatten(screen.getByRole('button', { name: label }).props.style);
      expect(style.minHeight).toBeGreaterThanOrEqual(48);
      expect(style.minWidth).toBeGreaterThanOrEqual(48);
    }
  });

  describe('a chip that has just been turned on', () => {
    let scrollTo: jest.SpyInstance;

    // `measureLayout` of the chip answers with where the layout would put it inside the scroll content.
    const chipAt = (x: number, width: number) => {
      jest.spyOn(View.prototype, 'measureLayout').mockImplementation(((_relativeTo: unknown, onSuccess: (...args: number[]) => void) => {
        onSuccess(x, 0, width, 48);
      }) as never);
    };

    // On the Jest preset both are shared `jest.fn`s of the mocked classes, so `restoreAllMocks` does not
    // clear their calls: reset them by hand.
    beforeEach(() => {
      jest.mocked(useReducedMotionPreference).mockReturnValue(false);
      scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo').mockReset();
      jest.spyOn(View.prototype, 'measureLayout').mockReset();
    });

    const pressAndLayOut = async (name: string) => {
      const row = screen.getByLabelText('Filtros rápidos');
      await fireEvent(row, 'layout', layout(360));
      await fireEvent.press(screen.getByRole('button', { name }));
      await fireEvent(screen.getByRole('button', { name }), 'layout', layout(150, 48));
    };

    it('is scrolled into sight when its width makes it end past the edge of the row', async () => {
      await renderBar();
      chipAt(300, 150);

      await pressAndLayOut('Disponible');

      // It ends at 450 on a 360 wide row: scrolled so its end is the gutter (16) away from the edge.
      expect(scrollTo).toHaveBeenCalledWith({ x: 106, animated: true });
    });

    it('REDUCED MOTION (RF-15): it is brought into sight at the same place, without the slide', async () => {
      jest.mocked(useReducedMotionPreference).mockReturnValue(true);
      await renderBar();
      chipAt(300, 150);

      await pressAndLayOut('Disponible');

      expect(scrollTo).toHaveBeenCalledWith({ x: 106, animated: false });
    });

    it('is left alone when it is already fully in sight', async () => {
      await renderBar();
      chipAt(40, 150);

      await pressAndLayOut('Disponible');

      expect(scrollTo).not.toHaveBeenCalled();
    });

    it('does not scroll for a chip that only MOVED because another one grew', async () => {
      await renderBar();
      chipAt(300, 150);

      await fireEvent(screen.getByLabelText('Filtros rápidos'), 'layout', layout(360));
      await fireEvent(screen.getByRole('button', { name: 'Disponible' }), 'layout', layout(150, 48));

      expect(scrollTo).not.toHaveBeenCalled();
    });
  });
});

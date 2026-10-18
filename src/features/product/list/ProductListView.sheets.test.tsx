/// <reference types="jest" />
// RF-14 (T6a, G-2/G-3). The sort and filters sheets as a screen-reader user lives them: closing a
// sheet gives the focus back to the button that opened it, and that button's label already says the
// new state ("Sort: Price", "Filters, 1 active"), so the focus speech IS the confirmation. Nothing
// is announced on top (G-2: the old "applied" announcement made next to a focus move was cut off).
//
// Seen on the Samsung before this change: after "Sort by" closed, TalkBack's focus went to the
// screen's Back arrow (or nowhere), and "Sort applied: ..." was the only feedback.
//
// A sheet that opens and closes needs the interactive Gorhom stand-in (the default mock renders the
// content all the time and never closes).
//
// Compose: `ModalBottomSheet` + `onDismissRequest` restoring `FocusRequester`. SwiftUI: `.sheet`
// returns VoiceOver to the presenting button by itself.
import { act, fireEvent, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { useReducedMotionPreference } from '@/core/accessibility/use-reduced-motion';
import { wireBrands, wireCategories, wireProductPage } from '@/test/fixtures';
import { createMockFetch, reply } from '@/test/mock-fetch';
import { setAppForeground } from '@/test/app-state';
import { resetRouterMock } from '@/test/mock-expo-router';
import { resetReconnectionMock } from '@/test/mock-reconnection';
import { renderWithProviders } from '@/test/render-with-providers';

import { ProductListView } from './ProductListView';

jest.mock('@gorhom/bottom-sheet', () => jest.requireActual('@/test/gorhom-interactive-mock').gorhomModule);
jest.mock('expo-router', () => jest.requireActual('@/test/mock-expo-router').expoRouterModule);
jest.mock('@/core/network/reconnection', () => jest.requireActual('@/test/mock-reconnection').reconnectionModule);
jest.mock('@/core/accessibility/use-reduced-motion', () => ({ useReducedMotionPreference: jest.fn(() => false) }));

type Language = 'es' | 'en';

const TEXT = {
  es: {
    sortButton: (option: string) => `Ordenar: ${option}`,
    featured: 'Destacados',
    priceAsc: 'Precio: de menor a mayor',
    sortTitle: 'Ordenar por',
    filtersButton: 'Filtros',
    filtersButtonActive: 'Filtros, 1 activo',
    filtersTitle: 'Filtros',
    apply: 'Aplicar',
    cancel: 'Cancelar',
    close: 'Cerrar',
    brand: 'AsterVale Nutrition',
  },
  en: {
    sortButton: (option: string) => `Sort: ${option}`,
    featured: 'Featured',
    priceAsc: 'Price: low to high',
    sortTitle: 'Sort by',
    filtersButton: 'Filters',
    filtersButtonActive: 'Filters, 1 active',
    filtersTitle: 'Filters',
    apply: 'Apply',
    cancel: 'Cancel',
    close: 'Close',
    brand: 'AsterVale Nutrition',
  },
} as const;

describe('ProductListView sheets and the screen reader', () => {
  let mock: ReturnType<typeof createMockFetch>;
  let focus: jest.SpyInstance;
  let announce: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    resetRouterMock();
    resetReconnectionMock();
    setAppForeground();
    jest.mocked(useReducedMotionPreference).mockReturnValue(false);
    mock = createMockFetch();
    mock.install();
    mock.always('GET /products', reply.success(wireProductPage(3)));
    mock.always('GET /brands', reply.success(wireBrands()));
    mock.always('GET /categories', reply.success(wireCategories()));
    focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
    announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    focus.mockClear();
    announce.mockClear();
  });

  afterEach(() => {
    expect(mock.unmatched).toEqual([]);
    mock.uninstall();
  });

  /** Small steps, one `act` each (the sheet closes in a timer and the focus move follows its commit). */
  const advance = async (ms: number) => {
    for (let elapsed = 0; elapsed < Math.max(ms, 1); elapsed += 50) {
      await act(async () => {
        await jest.advanceTimersByTimeAsync(Math.min(50, Math.max(ms, 1)));
      });
    }
  };

  async function mount(language: Language) {
    await renderWithProviders(
      <ProductListView header={null} onOpenProduct={jest.fn()} scope={{ category: 'vitamins' }} />,
      { language },
    );
    await advance(10);
  }

  /**
   * The accessible name of the last element the screen reader was sent to. The test renderer hands
   * the mocked native view as the "instance", and its props are what the screen reader would read.
   */
  const focusedName = () => {
    const target = focus.mock.calls.at(-1)?.[0] as { props?: { accessibilityLabel?: string } } | undefined;
    return target?.props?.accessibilityLabel;
  };

  describe.each<Language>(['es', 'en'])('in %s', (language) => {
    const text = TEXT[language];

    it('SORT: choosing an option closes the sheet and puts the focus on the sort button, now named with the new order (no announcement on top)', async () => {
      await mount(language);
      await fireEvent.press(screen.getByRole('button', { name: text.sortButton(text.featured) }));
      await advance(60);
      expect(screen.getByRole('header', { name: text.sortTitle })).toBeOnTheScreen();
      focus.mockClear();
      announce.mockClear();

      await fireEvent.press(screen.getByRole('radio', { name: text.priceAsc }));
      await advance(1_000);

      // The sheet is gone and the button carries the new state...
      expect(screen.queryByRole('header', { name: text.sortTitle })).not.toBeOnTheScreen();
      expect(screen.getByRole('button', { name: text.sortButton(text.priceAsc) })).toBeOnTheScreen();
      // ...the focus went to that button (the one the user pressed to open the sheet)...
      expect(focusedName()).toBe(text.sortButton(text.priceAsc));
      expect(focus).toHaveBeenCalledTimes(1);
      // ...and nothing is announced: the focus speech already says "Sort: <new order>".
      expect(announce).not.toHaveBeenCalled();
    });

    it('SORT: closing with the Close button (no result) returns the focus and announces nothing', async () => {
      await mount(language);
      await fireEvent.press(screen.getByRole('button', { name: text.sortButton(text.featured) }));
      await advance(60);
      focus.mockClear();

      await fireEvent.press(screen.getByRole('button', { name: text.close }));
      await advance(1_000);

      expect(focus).toHaveBeenCalledTimes(1);
      expect(focusedName()).toBe(text.sortButton(text.featured));
      expect(announce).not.toHaveBeenCalled();
    });

    it('FILTERS: Apply returns the focus to the Filters button, now named with the active count (no announcement on top)', async () => {
      await mount(language);
      await fireEvent.press(screen.getByRole('button', { name: text.filtersButton }));
      await advance(60);
      expect(screen.getByRole('header', { name: text.filtersTitle })).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('checkbox', { name: text.brand }));
      focus.mockClear();
      announce.mockClear();

      await fireEvent.press(screen.getByRole('button', { name: text.apply }));
      await advance(1_000);

      expect(screen.getByRole('button', { name: text.filtersButtonActive })).toBeOnTheScreen();
      expect(focusedName()).toBe(text.filtersButtonActive);
      expect(focus).toHaveBeenCalledTimes(1);
      expect(announce).not.toHaveBeenCalled();
    });

    it('FILTERS: Cancel returns the focus and announces nothing (nothing was applied)', async () => {
      await mount(language);
      await fireEvent.press(screen.getByRole('button', { name: text.filtersButton }));
      await advance(60);
      await fireEvent.press(screen.getByRole('checkbox', { name: text.brand }));
      focus.mockClear();

      await fireEvent.press(screen.getByRole('button', { name: text.cancel }));
      await advance(1_000);

      expect(focus).toHaveBeenCalledTimes(1);
      expect(focusedName()).toBe(text.filtersButton);
      expect(announce).not.toHaveBeenCalled();
      // The filter was not applied: the button still says "Filters" with no count.
      expect(screen.getByRole('button', { name: text.filtersButton })).toBeOnTheScreen();
    });
  });
});

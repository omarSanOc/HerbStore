/// <reference types="jest" />
// RF-14 (T6a, S-6). The recent searches as a screen-reader user lives them. Removing an entry or
// clearing the list makes the focused button disappear; the reader then jumps wherever it likes
// (on the Samsung: to the search field, and its focus speech cut the announcement "removed from
// recent searches" off after ~2 s). The list now decides: the focus goes to a neighbouring entry
// (or the heading when none is left) and the news is announced AFTER it.
//
// Compose: `LazyColumn` + `FocusRequester` on the next item, `announceForAccessibility`.
// SwiftUI: `@AccessibilityFocusState` on the next row and `AccessibilityNotification.Announcement`.
import { act, fireEvent, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { useState } from 'react';

import { ANNOUNCE_AFTER_FOCUS_MS } from '@/core/accessibility/screen-reader-focus';
import { renderWithProviders } from '@/test/render-with-providers';

import { SearchHistoryList } from './SearchHistoryList';

type Language = 'es' | 'en';

const TEXT = {
  es: {
    heading: 'Búsquedas recientes',
    clearAll: 'Borrar todo',
    cleared: 'Búsquedas recientes borradas',
    removeLabel: (entry: string) => `Quitar «${entry}» de las búsquedas recientes`,
    removed: (entry: string) => `«${entry}» quitada de las búsquedas recientes`,
    empty: 'Aún no has buscado nada. Escribe arriba para encontrar productos.',
  },
  en: {
    heading: 'Recent searches',
    clearAll: 'Clear all',
    cleared: 'Recent searches cleared',
    removeLabel: (entry: string) => `Remove “${entry}” from recent searches`,
    removed: (entry: string) => `“${entry}” removed from recent searches`,
    empty: 'You have not searched yet. Type above to find products.',
  },
} as const;

/** The list owns no data: a screen does (Redux). The harness plays that role. */
function Harness({ initial }: Readonly<{ initial: readonly string[] }>) {
  const [entries, setEntries] = useState(initial);
  return (
    <SearchHistoryList
      entries={entries}
      onClear={() => setEntries([])}
      onRemove={(entry) => setEntries((current) => current.filter((e) => e !== entry))}
      onSelect={() => {}}
    />
  );
}

describe('SearchHistoryList and the screen reader (S-6)', () => {
  let focus: jest.SpyInstance;
  let announce: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
    announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    focus.mockClear();
    announce.mockClear();
  });

  const advance = (ms: number) =>
    act(async () => {
      await jest.advanceTimersByTimeAsync(ms);
    });

  /**
   * What the reader was sent to, by the words it would read: an entry's button is named by its
   * text; the heading by its title. (The test renderer hands over the mocked native view, whose
   * props are what the reader reads.)
   */
  const focusedName = () => {
    const target = focus.mock.calls.at(-1)?.[0] as
      | { props?: { accessibilityLabel?: string; children?: unknown } }
      | undefined;
    return target?.props?.accessibilityLabel ?? target?.props?.children;
  };

  describe.each<Language>(['es', 'en'])('in %s', (language) => {
    const text = TEXT[language];

    it('REMOVING an entry in the middle: the focus goes to the entry that took its place, then the removal is announced', async () => {
      await renderWithProviders(<Harness initial={['vit', 'zinc', 'omega']} />, { language });
      const order: string[] = [];
      focus.mockImplementation(() => void order.push('focus'));
      announce.mockImplementation(() => void order.push('announce'));

      await fireEvent.press(screen.getByRole('button', { name: text.removeLabel('zinc') }));
      await advance(ANNOUNCE_AFTER_FOCUS_MS - 1);

      expect(screen.queryByRole('button', { name: text.removeLabel('zinc') })).not.toBeOnTheScreen();
      expect(focusedName()).toBe('omega');
      expect(announce).not.toHaveBeenCalled();

      await advance(1);
      expect(announce).toHaveBeenCalledTimes(1);
      expect(announce).toHaveBeenCalledWith(text.removed('zinc'));
      expect(order).toEqual(['focus', 'announce']);
    });

    it('REMOVING the last entry of several: the focus goes to the one before it', async () => {
      await renderWithProviders(<Harness initial={['vit', 'zinc']} />, { language });

      await fireEvent.press(screen.getByRole('button', { name: text.removeLabel('zinc') }));
      await advance(ANNOUNCE_AFTER_FOCUS_MS);

      expect(focusedName()).toBe('vit');
      expect(announce).toHaveBeenCalledWith(text.removed('zinc'));
    });

    it('REMOVING the only entry: the focus goes to the heading and the list says it is empty', async () => {
      await renderWithProviders(<Harness initial={['vit']} />, { language });

      await fireEvent.press(screen.getByRole('button', { name: text.removeLabel('vit') }));
      await advance(ANNOUNCE_AFTER_FOCUS_MS);

      expect(focusedName()).toBe(text.heading);
      expect(screen.getByText(text.empty)).toBeOnTheScreen();
      expect(announce).toHaveBeenCalledWith(text.removed('vit'));
    });

    it('CLEARING all: the focus goes to the heading (its row of buttons is gone) and the clearing is announced after it', async () => {
      await renderWithProviders(<Harness initial={['vit', 'zinc']} />, { language });
      const order: string[] = [];
      focus.mockImplementation(() => void order.push('focus'));
      announce.mockImplementation(() => void order.push('announce'));

      await fireEvent.press(screen.getByRole('button', { name: text.clearAll }));
      await advance(ANNOUNCE_AFTER_FOCUS_MS);

      expect(screen.getByText(text.empty)).toBeOnTheScreen();
      expect(focusedName()).toBe(text.heading);
      expect(announce).toHaveBeenCalledTimes(1);
      expect(announce).toHaveBeenCalledWith(text.cleared);
      expect(order).toEqual(['focus', 'announce']);
    });

    it('leaving the screen right after removing makes no late announcement', async () => {
      const view = await renderWithProviders(<Harness initial={['vit', 'zinc']} />, { language });

      await fireEvent.press(screen.getByRole('button', { name: text.removeLabel('vit') }));
      await view.unmount();
      await advance(ANNOUNCE_AFTER_FOCUS_MS * 2);

      expect(announce).not.toHaveBeenCalled();
    });
  });
});

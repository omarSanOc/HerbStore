/// <reference types="jest" />
// RF-9, RF-23, RF-30, RF-34 (spec 007, T3). The advanced-filters panel in every state the user
// meets (the matrix of RF-30): loading, without options, offline, error, and previous options kept
// after a failed refresh. Every state has an accessible message (live region) and, when there is
// nothing to show, a retry button; the names are copy OF THE CATALOG, printed as the localized
// response sent them, and a language change never paints the options of the language being left.
//
// Android: a `sealed interface FacetUiState` plus `LazyColumn`; TalkBack reads the live region.
// SwiftUI: an enum rendered by one `switch`, with `.accessibilityAddTraits(.updatesFrequently)`.
import { act, fireEvent, screen } from '@testing-library/react-native';
import { createRef } from 'react';

import { i18n } from '@/core/i18n';
import type { AppBottomSheetHandle } from '@/design-system';
import { createTestStore, wireBrands } from '@/test/fixtures';
import { createMockFetch, reply, type MockReply } from '@/test/mock-fetch';
import { renderWithProviders } from '@/test/render-with-providers';

import { DEFAULT_LIST_PARAMS } from '../logic/list-params';
import { AdvancedFiltersSheet } from './AdvancedFiltersSheet';

type Language = 'es' | 'en';

const TEXT = {
  es: {
    subcategoriesHeading: 'Subcategorías',
    subcategory: 'Vitamínicos del día',
    loading: 'Cargando opciones…',
    noBrands: 'No hay marcas para mostrar.',
    offline: 'Sin conexión. No se pudieron cargar las opciones.',
    loadFailed: 'No se pudieron cargar las opciones.',
    updateFailed: 'No se pudieron actualizar las opciones. Se muestran las últimas recibidas.',
    retry: 'Reintentar',
    brand: 'AsterVale Nutrition',
  },
  en: {
    subcategoriesHeading: 'Subcategories',
    subcategory: 'Daily multivitamins',
    loading: 'Loading options…',
    noBrands: 'There are no brands to show.',
    offline: 'You are offline. The options could not be loaded.',
    loadFailed: 'The options could not be loaded.',
    updateFailed: 'The options could not be updated. Showing the last ones received.',
    retry: 'Retry',
    brand: 'AsterVale Nutrition',
  },
} as const;

describe('AdvancedFiltersSheet panel', () => {
  let mock: ReturnType<typeof createMockFetch>;

  beforeEach(() => {
    jest.useFakeTimers();
    mock = createMockFetch();
    mock.install();
  });

  afterEach(() => {
    expect(mock.unmatched).toEqual([]);
    mock.uninstall();
  });

  const advance = (ms: number) =>
    act(async () => {
      await jest.advanceTimersByTimeAsync(ms);
    });

  /** The sheet alone (the official gorhom mock renders its content without presenting it). */
  function mount(language: Language, store = createTestStore()) {
    return renderWithProviders(
      <AdvancedFiltersSheet ref={createRef<AppBottomSheetHandle>()} applied={DEFAULT_LIST_PARAMS} onApply={jest.fn()} />,
      { language, store },
    );
  }

  /** A tree whose only subcategory has the name the API sent in that language. */
  function categoriesReply(language: Language, options: { delayMs?: number } = {}) {
    return reply.localized(
      [
        {
          id: 'vitamins',
          name: language === 'es' ? 'Vitaminas' : 'Vitamins',
          productCount: 12,
          subcategories: [{ id: 'multivitamins', name: TEXT[language].subcategory, productCount: 12 }],
        },
      ],
      language,
      options,
    );
  }

  const brandRequests = () => mock.calls.filter(({ path }) => path === '/brands');

  it.each<Language>(['es', 'en'])('RF-9: a subcategory shows the name the API sent in %s', async (language) => {
    mock.always('GET /brands', reply.localized(wireBrands(), language));
    mock.always('GET /categories', categoriesReply(language));

    await mount(language);
    await advance(10);

    expect(screen.getByRole('checkbox', { name: TEXT[language].subcategory })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: TEXT[language].subcategoriesHeading })).toBeOnTheScreen();
  });

  // ---- RF-30: the matrix of states of the panel -------------------------------------------
  describe.each<Language>(['es', 'en'])('states, in %s', (language) => {
    const text = TEXT[language];

    it('LOADING: a named, polite message while the options are in flight, no retry', async () => {
      mock.always('GET /brands', reply.localized(wireBrands(), language, { delayMs: 1_000 }));
      mock.always('GET /categories', categoriesReply(language));

      await mount(language);
      await advance(1);

      expect(screen.getByText(text.loading)).toBeOnTheScreen();
      expect(screen.queryByRole('checkbox', { name: text.brand })).not.toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: text.retry })).not.toBeOnTheScreen();
    });

    it('EMPTY: a valid empty array says there are no options (never an endless loading)', async () => {
      mock.always('GET /brands', reply.localized([], language));
      mock.always('GET /categories', categoriesReply(language));

      await mount(language);
      await advance(10);

      expect(screen.getByText(text.noBrands)).toBeOnTheScreen();
      expect(screen.queryByText(text.loading)).not.toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: text.retry })).not.toBeOnTheScreen();
      // The panel is operable: the sheet's own actions are still there.
      expect(screen.getByRole('button', { name: language === 'es' ? 'Aplicar' : 'Apply' })).toBeOnTheScreen();
    });

    it('OFFLINE: no response says so with a retry that recovers (2 automatic retries first)', async () => {
      mock.enqueue(
        'GET /brands',
        reply.networkError(),
        reply.networkError(),
        reply.networkError(),
        reply.localized(wireBrands(), language),
      );
      mock.always('GET /categories', categoriesReply(language));

      await mount(language);
      await advance(1_510);

      expect(brandRequests()).toHaveLength(3);
      expect(screen.getByText(text.offline)).toBeOnTheScreen();
      expect(screen.queryByText(text.loadFailed)).not.toBeOnTheScreen();

      await fireEvent.press(screen.getByRole('button', { name: text.retry }));
      await advance(10);

      expect(brandRequests()).toHaveLength(4);
      expect(screen.getByRole('checkbox', { name: text.brand })).toBeOnTheScreen();
      expect(screen.queryByText(text.offline)).not.toBeOnTheScreen();
    });

    it('ERROR: a 5xx says so (a different message from "offline") with the same retry', async () => {
      mock.enqueue(
        'GET /brands',
        reply.serverError(),
        reply.serverError(),
        reply.serverError(),
        reply.localized(wireBrands(), language),
      );
      mock.always('GET /categories', categoriesReply(language));

      await mount(language);
      await advance(1_510);

      expect(brandRequests()).toHaveLength(3);
      expect(screen.getByText(text.loadFailed)).toBeOnTheScreen();
      expect(screen.queryByText(text.offline)).not.toBeOnTheScreen();

      await fireEvent.press(screen.getByRole('button', { name: text.retry }));
      await advance(10);

      expect(brandRequests()).toHaveLength(4);
      expect(screen.getByRole('checkbox', { name: text.brand })).toBeOnTheScreen();
    });

    it('STALE: a failed refresh keeps the previous options with an update-failed notice and a retry', async () => {
      mock.always('GET /brands', reply.localized(wireBrands(), language));
      mock.always('GET /categories', categoriesReply(language));
      const store = createTestStore();
      const view = await mount(language, store);
      await advance(10);
      expect(screen.getByRole('checkbox', { name: text.brand })).toBeOnTheScreen();

      // The options are older than 60 s, so opening the sheet again revalidates them. `unmount`
      // is ASYNC in RNTL 14: awaiting it keeps React's commit queue clean (an un-awaited unmount
      // makes every later render of the file come out empty).
      await advance(61_000);
      await view.unmount();
      mock.enqueue('GET /brands', reply.networkError(), reply.networkError(), reply.networkError());

      await mount(language, store);
      await advance(1_510);

      // ...and the failure does not throw the options away: they stay, with the notice (RF-30).
      expect(screen.getByRole('checkbox', { name: text.brand })).toBeOnTheScreen();
      expect(screen.getByText(text.updateFailed)).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: text.retry })).toBeOnTheScreen();
      expect(screen.queryByText(text.loading)).not.toBeOnTheScreen();
    });
  });

  // RF-24, RNF-3. `currentData`, never `data`: while the options of the new language are in
  // flight the panel announces loading instead of keeping the names of the language being left.
  it('LANGUAGE: a change in flight shows loading, never the options of the previous language', async () => {
    const esReplies: [string, MockReply][] = [
      ['GET /brands', reply.localized(wireBrands(), 'es')],
      ['GET /categories', categoriesReply('es')],
    ];
    for (const [route, replyValue] of esReplies) mock.always(route, replyValue);
    await mount('es');
    await advance(10);
    expect(screen.getByRole('checkbox', { name: TEXT.es.subcategory })).toBeOnTheScreen();

    // The user switches to English: both facet reads start again in the new language, slowly.
    mock.always('GET /brands', reply.localized(wireBrands(), 'en', { delayMs: 500 }));
    mock.always('GET /categories', categoriesReply('en', { delayMs: 500 }));
    await act(async () => {
      await i18n.changeLanguage('en');
    });
    await advance(10);

    // Both facets are loading at once, so the message appears once per panel.
    expect(screen.getAllByText(TEXT.en.loading)).toHaveLength(2);
    expect(screen.queryByRole('checkbox', { name: TEXT.es.subcategory })).not.toBeOnTheScreen();

    await advance(510);

    expect(screen.getByRole('checkbox', { name: TEXT.en.subcategory })).toBeOnTheScreen();
    expect(screen.queryByText(TEXT.en.loading)).not.toBeOnTheScreen();
  });
});

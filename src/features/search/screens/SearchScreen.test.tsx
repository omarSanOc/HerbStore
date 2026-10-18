/// <reference types="jest" />
// RF-4, RF-5 (T3a). Search as the user sees it: the history when the field is empty, the wait while
// typing (the 400 ms debounce), results, "no results", an offline/error state with its retry, and S-11.
//
// S-11 (day 3), closed here with the CURRENT decision: a search of only spaces is the same as an
// empty field, so the results view leaves and the filters that lived in it are gone. The test below
// pins that decision; changing it is a requirement change, not a refactor.
//
// Compose: `onNodeWithContentDescription("Search products").performTextInput("…")` with a
// `TestCoroutineScheduler` advancing the debounce. XCUITest: `typeText` and an expectation.
import { act, fireEvent, screen } from '@testing-library/react-native';
import { Profiler, type ProfilerOnRenderCallback } from 'react';
import { Platform } from 'react-native';

import { searchSent } from '@/features/search/store/search-history-slice';
import { createTestStore, wireBrands, wireCategories, wireProductPage } from '@/test/fixtures';
import { createMockFetch, reply } from '@/test/mock-fetch';
import { setAppForeground } from '@/test/app-state';
import { resetRouterMock } from '@/test/mock-expo-router';
import { emitReconnect, resetReconnectionMock } from '@/test/mock-reconnection';
import { renderWithProviders } from '@/test/render-with-providers';

import { SearchScreen } from './SearchScreen';

// Closed sheets render nothing (the default mock draws their content all the time, and their
// headings would count as part of the screen).
jest.mock('@gorhom/bottom-sheet', () => jest.requireActual('@/test/gorhom-interactive-mock').gorhomModule);
jest.mock('expo-router', () => jest.requireActual('@/test/mock-expo-router').expoRouterModule);
jest.mock('@/core/network/reconnection', () => jest.requireActual('@/test/mock-reconnection').reconnectionModule);

type Language = 'es' | 'en';

const TEXT = {
  es: {
    field: 'Buscar productos',
    historyEmpty: 'Aún no has buscado nada. Escribe arriba para encontrar productos.',
    historyTitle: 'Búsquedas recientes',
    results: (q: string) => `Resultados para «${q}»`,
    noResults: (q: string) => `Sin resultados para «${q}»`,
    clearSearch: 'Limpiar búsqueda',
    offline: 'Sin conexión con el servidor',
    retry: 'Reintentar',
    inStock: 'Disponible',
    loading: 'Cargando productos',
    offlineNotice: 'Sin conexión. Se muestran los últimos productos recibidos.',
  },
  en: {
    field: 'Search products',
    historyEmpty: 'You have not searched yet. Type above to find products.',
    historyTitle: 'Recent searches',
    results: (q: string) => `Results for “${q}”`,
    noResults: (q: string) => `No results for “${q}”`,
    clearSearch: 'Clear search',
    offline: 'No connection to the server',
    retry: 'Try again',
    inStock: 'Available',
    loading: 'Loading products',
    offlineNotice: 'You are offline. Showing the last products received.',
  },
} as const;

const advance = (ms: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });

/**
 * Advances in small steps, one `act` each. The debounce commits a state change at 400 ms and the
 * request only starts after React re-renders with it: a single big `act` would postpone that render
 * to its end and the retries would never be scheduled inside the window.
 */
const advanceInSteps = async (totalMs: number, stepMs = 100) => {
  for (let elapsed = 0; elapsed < totalMs; elapsed += stepMs) await advance(stepMs);
};

describe('SearchScreen', () => {
  let mock: ReturnType<typeof createMockFetch>;

  beforeEach(() => {
    jest.useFakeTimers();
    resetRouterMock();
    resetReconnectionMock();
    setAppForeground();
    mock = createMockFetch();
    mock.install();
    mock.always('GET /brands', reply.success(wireBrands()));
    mock.always('GET /categories', reply.success(wireCategories()));
  });

  afterEach(() => {
    expect(mock.unmatched).toEqual([]);
    mock.uninstall();
  });

  const productRequests = () => mock.calls.filter(({ path }) => path === '/products');
  const queryOf = (index: number) => new URL(productRequests()[index].url).searchParams.get('q');
  const field = (language: Language) => screen.getByLabelText(TEXT[language].field);
  const type = (language: Language, text: string) => fireEvent.changeText(field(language), text);

  describe.each<Language>(['es', 'en'])('in %s', (language) => {
    const text = TEXT[language];

    it('HISTORY: an empty field shows the recent searches (or says there are none) and asks nothing', async () => {
      await renderWithProviders(<SearchScreen />, { language });

      expect(field(language)).toBeOnTheScreen();
      expect(screen.getByRole('header', { name: text.historyTitle })).toBeOnTheScreen();
      expect(screen.getByText(text.historyEmpty)).toBeOnTheScreen();
      expect(mock.calls.filter(({ path }) => path === '/products')).toHaveLength(0);
    });

    it('TYPING: waits for the debounce (loading placeholder, no results), then asks ONCE with the last text', async () => {
      mock.enqueue('GET /products', reply.success(wireProductPage(2)));
      await renderWithProviders(<SearchScreen />, { language });

      await type(language, 'v');
      await advance(100);
      await type(language, 'vi');
      await advance(100);
      await type(language, 'vita');
      await advance(399);

      expect(productRequests()).toHaveLength(0);
      expect(screen.getByLabelText(text.loading)).toBeOnTheScreen();

      await advance(1);
      await advance(10);
      expect(productRequests()).toHaveLength(1);
      expect(queryOf(0)).toBe('vita');
      expect(screen.getByRole('header', { name: text.results('vita') })).toBeOnTheScreen();
      expect(screen.getAllByRole('button', { name: /^Complete Daily Powder/ })).toHaveLength(2);
    });

    it('NO RESULTS: says so with the text searched, and "clear search" goes back to the history', async () => {
      mock.enqueue('GET /products', reply.empty());
      await renderWithProviders(<SearchScreen />, { language });

      await type(language, 'zzz');
      await advance(410);
      await advance(10);

      expect(screen.getByRole('header', { name: text.noResults('zzz') })).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: text.clearSearch }));

      expect(screen.getByRole('header', { name: text.historyTitle })).toBeOnTheScreen();
      expect(field(language).props.value).toBe('');
    });

    // S-5 (T6a). A screen reader lists the headings of a screen as its outline. "Results for «zzz»"
    // above "No results for «zzz»" says the same thing twice and makes the outline lie (two sections
    // where there is one).
    it('NO RESULTS has ONE heading: the title of the results is not repeated above "no results" (S-5)', async () => {
      mock.enqueue('GET /products', reply.empty());
      await renderWithProviders(<SearchScreen />, { language });

      await type(language, 'zzz');
      await advance(410);
      await advance(10);

      expect(screen.getAllByRole('header').map((heading) => heading.props.children)).toEqual([
        text.noResults('zzz'),
      ]);
      expect(screen.queryByRole('header', { name: text.results('zzz') })).not.toBeOnTheScreen();
    });

    it('NO RESULTS with filters on also has ONE heading (S-5), and the chips stay', async () => {
      mock.enqueue('GET /products', reply.success(wireProductPage(2)), reply.empty());
      await renderWithProviders(<SearchScreen />, { language });
      await type(language, 'vita');
      await advance(410);
      await advance(10);
      expect(screen.getByRole('header', { name: text.results('vita') })).toBeOnTheScreen();

      await fireEvent.press(screen.getByRole('button', { name: text.inStock }));
      await advance(10);

      expect(screen.getAllByRole('header')).toHaveLength(1);
      expect(screen.queryByRole('header', { name: text.results('vita') })).not.toBeOnTheScreen();
      expect(screen.getByRole('button', { name: text.inStock })).toBeOnTheScreen();
    });

    it('OFFLINE: says there is no connection, keeps the field and "retry" asks again', async () => {
      mock.enqueue('GET /products', reply.networkError(), reply.networkError(), reply.networkError());
      await renderWithProviders(<SearchScreen />, { language });

      await type(language, 'vita');
      await advanceInSteps(2_500);

      expect(screen.getByRole('header', { name: text.offline })).toBeOnTheScreen();
      expect(field(language).props.value).toBe('vita');

      mock.enqueue('GET /products', reply.success(wireProductPage(1)));
      await fireEvent.press(screen.getByRole('button', { name: text.retry }));
      await advance(10);

      expect(screen.getByRole('header', { name: text.results('vita') })).toBeOnTheScreen();
    });
  });

  // RF-17 (T3b). The results of a search stay on screen when their revalidation fails.
  it.each<Language>(['es', 'en'])('PREVIOUS RESULTS (%s): a failed revalidation keeps them with an offline notice and the field', async (language) => {
    const text = TEXT[language];
    mock.enqueue('GET /products', reply.success(wireProductPage(2)));
    await renderWithProviders(<SearchScreen />, { language });
    await type(language, 'vita');
    await advanceInSteps(500);
    expect(screen.getByRole('header', { name: text.results('vita') })).toBeOnTheScreen();
    await advance(61_000);
    mock.enqueue('GET /products', reply.networkError(), reply.networkError(), reply.networkError());

    await act(async () => {
      emitReconnect();
    });
    await advanceInSteps(1_600);

    expect(screen.getByText(text.offlineNotice)).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: text.results('vita') })).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: text.offline })).not.toBeOnTheScreen();
    expect(field(language).props.value).toBe('vita');
  });

  it('SENDING a search (keyboard key) writes it in the history; merely typing does not', async () => {
    mock.enqueue('GET /products', reply.success(wireProductPage(1)));
    const store = createTestStore();
    await renderWithProviders(<SearchScreen />, { store });

    await type('es', 'vita');
    await advance(420);
    expect(store.getState().searchHistory.entries).toEqual([]);

    await fireEvent(field('es'), 'submitEditing', { nativeEvent: { text: 'vita' } });
    expect(store.getState().searchHistory.entries).toEqual(['vita']);
  });

  it('a recent search can be run again from the history', async () => {
    mock.enqueue('GET /products', reply.success(wireProductPage(1)));
    const store = createTestStore();
    store.dispatch(searchSent('magnesio'));
    await renderWithProviders(<SearchScreen />, { store });

    await fireEvent.press(screen.getByRole('button', { name: 'magnesio' }));
    await advance(10);

    expect(queryOf(0)).toBe('magnesio');
    expect(field('es').props.value).toBe('magnesio');
  });

  // The hint of the field (its placeholder) must leave the screen with the FIRST character.
  //
  // Defect (found validating T3a, Samsung SM-A037M): on Android the placeholder is drawn by JS
  // (`SearchField`, S-7), so it only disappears when React COMMITS the new `value`. The first key
  // also mounts the whole results view (filters, skeleton, list), and with everything in ONE render
  // the commit came ~300 ms after the key: the typed text showed over the hint. The field must
  // commit on its own, before the heavy results view.
  //
  // RNTL cannot see a native placeholder, and `act` flushes every pending render, so the test
  // watches each COMMIT through a `Profiler` and asks what was on screen at that instant.
  describe('the hint leaves with the first character (Android draws it in JS)', () => {
    const HINT = 'Buscar por marca, nombre o descripción';
    // The drawn hint is hidden from the screen reader on purpose (S-7), so queries must include it.
    const HIDDEN_FROM_READER = { includeHiddenElements: true };
    const hintShown = () => screen.queryByText(HINT, HIDDEN_FROM_READER) !== null;

    afterEach(() => jest.restoreAllMocks());

    it('the first commit after a key already shows the text and no hint, WITHOUT the results view yet', async () => {
      jest.replaceProperty(Platform, 'OS', 'android');
      mock.enqueue('GET /products', reply.success(wireProductPage(2)));
      const commits: { value: unknown; hint: boolean; resultsView: boolean }[] = [];
      let watching = false;
      const onRender: ProfilerOnRenderCallback = () => {
        if (!watching) return;
        commits.push({
          value: screen.getByLabelText(TEXT.es.field).props.value,
          hint: hintShown(),
          resultsView: screen.queryByLabelText(TEXT.es.loading) !== null,
        });
      };
      await renderWithProviders(
        <Profiler id="search" onRender={onRender}>
          <SearchScreen />
        </Profiler>,
      );
      expect(screen.getByText(HINT, HIDDEN_FROM_READER)).toBeOnTheScreen();
      watching = true;

      await type('es', 'v');

      // First commit: the field has the text, the hint is gone and the heavy view has NOT mounted.
      expect(commits[0]).toEqual({ value: 'v', hint: false, resultsView: false });
      // The results view arrives in a later commit of the same interaction (nothing is lost).
      expect(commits.at(-1)).toEqual({ value: 'v', hint: false, resultsView: true });
    });

    it('is drawn only while the field is empty, and again after "clear"', async () => {
      jest.replaceProperty(Platform, 'OS', 'android');
      mock.enqueue('GET /products', reply.success(wireProductPage(1)));
      await renderWithProviders(<SearchScreen />);
      expect(screen.getByText(HINT, HIDDEN_FROM_READER)).toBeOnTheScreen();

      await type('es', 'vita');
      expect(screen.queryByText(HINT, HIDDEN_FROM_READER)).not.toBeOnTheScreen();

      await fireEvent.press(screen.getByRole('button', { name: 'Borrar texto' }));
      expect(screen.getByText(HINT, HIDDEN_FROM_READER)).toBeOnTheScreen();
    });

    it('iOS keeps the NATIVE placeholder: drawn nowhere, the prop carries it', async () => {
      await renderWithProviders(<SearchScreen />);
      expect(screen.queryByText(HINT, HIDDEN_FROM_READER)).not.toBeOnTheScreen();
      expect(field('es').props.placeholder).toBe(HINT);
    });
  });

  describe('S-11 (decision): a search of only spaces is an empty search', () => {
    it('leaves the results view, drops its filters, and does not query', async () => {
      mock.enqueue('GET /products', reply.success(wireProductPage(2)), reply.success(wireProductPage(2)), reply.success(wireProductPage(2)));
      await renderWithProviders(<SearchScreen />);
      await type('es', 'vita');
      await advance(420);
      await fireEvent.press(screen.getByRole('button', { name: TEXT.es.inStock }));
      await advance(10);
      expect(screen.getByRole('button', { name: TEXT.es.inStock })).toBeSelected();
      const requestsBefore = productRequests().length;

      await type('es', '   ');
      await advance(1_000);

      // The list (and the filter chips that live in it) is gone; the history is back.
      expect(screen.getByRole('header', { name: TEXT.es.historyTitle })).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: TEXT.es.inStock })).not.toBeOnTheScreen();
      expect(productRequests()).toHaveLength(requestsBefore);

      // Typing again starts from a clean list: the filter did not survive.
      await type('es', 'vita');
      await advance(420);
      expect(screen.getByRole('button', { name: TEXT.es.inStock })).not.toBeSelected();
    });
  });
});

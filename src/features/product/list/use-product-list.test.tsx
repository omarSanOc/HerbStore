/// <reference types="jest" />
// RF-5, RF-17 (T2). The product-list ViewModel on the real RTK Query stack, with a controlled
// `fetch` that can be SLOW: this is how the pull-to-refresh vs "load more" race (day 3, never
// observed on iOS because `axe` was too slow) becomes deterministic. Time is a test input.
//
// Compose: a `ViewModel` test with `Pager` + `TestDispatcher.advanceTimeBy`. SwiftUI: a `Task`
// with an injected `Clock`. In both, "the user pulls while the next page is in flight" is a
// scheduled sequence, not a reflex test on a device.
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Provider as ReduxProvider } from 'react-redux';

import { buildProductQueryArgs } from '@/features/product/logic/product-query';
import { createTestStore, wireProduct } from '@/test/fixtures';
import { createMockFetch, reply } from '@/test/mock-fetch';

import { useProductList } from './use-product-list';

// The hook reads navigation focus and network reconnection only to revalidate stale data in the
// background (a different rule, covered in `freshness.test.ts`); here the screen is focused and the
// network never "reconnects", so neither can start a request of its own.
jest.mock('expo-router', () => ({ useIsFocused: () => true }));
jest.mock('@/core/network/reconnection', () => ({ onReconnect: () => () => undefined }));

const ARGS = buildProductQueryArgs({});
const PAGE_SIZE = 20;

/** `GET /products?page=N` as the server sends it: ids are unique across pages. */
function wirePage(page: number, { totalPages = 3, nameSuffix = '' } = {}) {
  return {
    items: Array.from({ length: PAGE_SIZE }, (_, i) =>
      wireProduct((page - 1) * PAGE_SIZE + i + 1, { name: `Powder ${(page - 1) * PAGE_SIZE + i + 1}${nameSuffix}` }),
    ),
    page,
    totalPages,
    total: totalPages * PAGE_SIZE,
  };
}

const LAST_ITEM_VISIBLE = { viewableItems: [{ index: PAGE_SIZE - 1 }] };

describe('useProductList: pull-to-refresh vs "load more"', () => {
  let mock: ReturnType<typeof createMockFetch>;
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    jest.useFakeTimers();
    mock = createMockFetch();
    mock.install();
    store = createTestStore();
  });

  afterEach(() => {
    mock.uninstall();
  });

  const wrapper = ({ children }: Readonly<{ children: ReactNode }>) => <ReduxProvider store={store}>{children}</ReduxProvider>;
  const advance = (ms: number) => act(async () => { await jest.advanceTimersByTimeAsync(ms); });
  const pagesRequested = () => mock.calls.map(({ url }) => new URL(url).searchParams.get('page'));

  /** Mounts the hook and lets page 1 land (the server answers at once). */
  async function mountWithFirstPage() {
    mock.enqueue('GET /products', reply.success(wirePage(1)));
    const view = await renderHook(() => useProductList(ARGS), { wrapper });
    await advance(0);
    expect(view.result.current.state).toMatchObject({ status: 'ready', footer: 'idle' });
    return view;
  }

  const readyProducts = (state: ReturnType<typeof useProductList>['state']) => (state.status === 'ready' ? state.products : []);

  it('loads page 1 and then, when the last items become visible, exactly one more page', async () => {
    const { result } = await mountWithFirstPage();
    expect(readyProducts(result.current.state)).toHaveLength(PAGE_SIZE);

    mock.enqueue('GET /products', reply.success(wirePage(2), { delayMs: 1_000 }));
    await act(async () => { result.current.onViewableItemsChanged(LAST_ITEM_VISIBLE); });
    // FlashList fires the callback many times per scroll: only the first one asks.
    await act(async () => { result.current.onViewableItemsChanged(LAST_ITEM_VISIBLE); });
    await act(async () => { result.current.onViewableItemsChanged(LAST_ITEM_VISIBLE); });
    await advance(0);

    expect(result.current.state).toMatchObject({ status: 'ready', footer: 'loading-more' });
    expect(pagesRequested()).toEqual(['1', '2']);

    await advance(999);
    expect(result.current.state).toMatchObject({ footer: 'loading-more' });
    await advance(1);
    await advance(10); // the hook commits the fulfilled entry on the next few ms of the fake clock
    expect(readyProducts(result.current.state)).toHaveLength(PAGE_SIZE * 2);
    expect(result.current.state).toMatchObject({ footer: 'idle' });
    expect(pagesRequested()).toEqual(['1', '2']);
  });

  it('RACE: a pull while page 2 is in flight aborts page 2 and ends with ONLY a fresh page 1', async () => {
    const { result } = await mountWithFirstPage();

    // Page 2 is slow. The user pulls to refresh while it is still travelling.
    mock.enqueue('GET /products', reply.success(wirePage(2), { delayMs: 3_000 }));
    await act(async () => { result.current.onViewableItemsChanged(LAST_ITEM_VISIBLE); });
    await advance(1_000);
    expect(result.current.state).toMatchObject({ footer: 'loading-more' });

    // The refresh answers page 1 with different names, so we can tell old from new.
    mock.enqueue('GET /products', reply.success(wirePage(1, { nameSuffix: ' (fresh)' }), { delayMs: 500 }));
    await act(async () => { result.current.onRefresh(); });
    await advance(0);

    // 1) the pull is visibly refreshing while the list stays on screen.
    expect(result.current.isRefreshing).toBe(true);
    expect(readyProducts(result.current.state).length).toBeGreaterThan(0);

    // 2) the refresh does NOT wait for page 2: it ends at ~1.5 s, long before page 2 would have
    //    landed (3 s). Without the abort the pull would sit behind the slow page ("await pending").
    await advance(500);
    await advance(10);
    expect(result.current.isRefreshing).toBe(false);
    expect(readyProducts(result.current.state).every(({ name }) => name.endsWith('(fresh)'))).toBe(true);

    // 3) page 2 never lands afterwards, even after the time it would have taken.
    await advance(3_000);

    expect(pagesRequested()).toEqual(['1', '2', '1']);
    expect(result.current.isRefreshing).toBe(false);
    const products = readyProducts(result.current.state);
    expect(products).toHaveLength(PAGE_SIZE);
    expect(products.every(({ name }) => name.endsWith('(fresh)'))).toBe(true);
    expect(products.map(({ id }) => id)).not.toContain(`product-261009-${String(PAGE_SIZE + 1).padStart(3, '0')}`);
    expect(result.current.state).toMatchObject({ status: 'ready', footer: 'idle' });
    expect(result.current.state).not.toHaveProperty('notice');
  });

  it('RACE: after the pull the "load more" guard is open again, so page 2 can be requested once more', async () => {
    const { result } = await mountWithFirstPage();
    mock.enqueue('GET /products', reply.success(wirePage(2), { delayMs: 3_000 }));
    await act(async () => { result.current.onViewableItemsChanged(LAST_ITEM_VISIBLE); });
    await advance(100);
    mock.enqueue('GET /products', reply.success(wirePage(1, { nameSuffix: ' (fresh)' })));
    await act(async () => { result.current.onRefresh(); });
    await advance(0);
    await advance(3_000);
    expect(pagesRequested()).toEqual(['1', '2', '1']);

    mock.enqueue('GET /products', reply.success(wirePage(2, { nameSuffix: ' (fresh)' })));
    await act(async () => { result.current.onViewableItemsChanged(LAST_ITEM_VISIBLE); });
    await advance(0);

    expect(pagesRequested()).toEqual(['1', '2', '1', '2']);
    expect(readyProducts(result.current.state)).toHaveLength(PAGE_SIZE * 2);
    expect(readyProducts(result.current.state).every(({ name }) => name.endsWith('(fresh)'))).toBe(true);
  });

  it('RACE: while a pull is running, reaching the end of the list does not request another page', async () => {
    const { result } = await mountWithFirstPage();
    mock.enqueue('GET /products', reply.success(wirePage(1, { nameSuffix: ' (fresh)' }), { delayMs: 2_000 }));

    await act(async () => { result.current.onRefresh(); });
    await advance(100);
    await act(async () => { result.current.onViewableItemsChanged(LAST_ITEM_VISIBLE); });
    await advance(0);

    expect(pagesRequested()).toEqual(['1', '1']);

    await advance(2_000);
    expect(result.current.isRefreshing).toBe(false);
    expect(readyProducts(result.current.state)).toHaveLength(PAGE_SIZE);
  });

  it('RACE: pulling twice in a row sends one refresh (the second pull is ignored while refreshing)', async () => {
    const { result } = await mountWithFirstPage();
    mock.enqueue('GET /products', reply.success(wirePage(1, { nameSuffix: ' (fresh)' }), { delayMs: 2_000 }));

    await act(async () => { result.current.onRefresh(); });
    await advance(100);
    await act(async () => { result.current.onRefresh(); });
    await advance(2_000);

    expect(pagesRequested()).toEqual(['1', '1']);
    expect(result.current.isRefreshing).toBe(false);
  });

  it('a failed page 2 keeps page 1 and the guard closed: no automatic loop, a manual retry asks once', async () => {
    const { result } = await mountWithFirstPage();
    mock.enqueue('GET /products', reply.clientError(404));
    await act(async () => { result.current.onViewableItemsChanged(LAST_ITEM_VISIBLE); });
    await advance(0);

    expect(result.current.state).toMatchObject({ status: 'ready', footer: 'load-more-failed' });
    expect(readyProducts(result.current.state)).toHaveLength(PAGE_SIZE);

    // Scrolling again does not hammer a failing server.
    await act(async () => { result.current.onViewableItemsChanged(LAST_ITEM_VISIBLE); });
    await advance(5_000);
    expect(pagesRequested()).toEqual(['1', '2']);

    mock.enqueue('GET /products', reply.success(wirePage(2)));
    await act(async () => { result.current.retryNextPage(); });
    await advance(0);
    expect(pagesRequested()).toEqual(['1', '2', '2']);
    expect(readyProducts(result.current.state)).toHaveLength(PAGE_SIZE * 2);
  });

  it('a refresh that fails keeps the products on screen with an offline notice', async () => {
    const { result } = await mountWithFirstPage();
    mock.always('GET /products', reply.networkError());

    await act(async () => { result.current.onRefresh(); });
    await advance(1_500); // two retries of the read policy
    await advance(0);

    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.state).toMatchObject({ status: 'ready', notice: 'offline' });
    expect(readyProducts(result.current.state)).toHaveLength(PAGE_SIZE);
  });
});
